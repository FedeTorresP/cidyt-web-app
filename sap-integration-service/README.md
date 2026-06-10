# SAP Integration Worker

Worker Python dockerizado que **consume la API OData de SAP** (a través del
túnel seguro de Google ya existente) y escribe en Cloud Firestore.

Cada `POLL_INTERVAL_MINUTES` ejecuta un ciclo: hace `GET` al endpoint OData,
parsea la respuesta (JSON o XML), normaliza todos los strings a Unicode **NFC**
y hace upsert en las colecciones `pacientes` y `seguimientos`.

> Arquitectura previa (lectura de XML desde un drop-folder con `watchdog`) fue
> reemplazada por polling OData. Ya no se montan volúmenes de red.

```
SAP OData API  ──GET (túnel Google)──►  Worker  ──upsert──►  Cloud Firestore
                                          │                   (pacientes,
                                   cada N minutos               seguimientos)
```

## Estructura

| Módulo                   | Responsabilidad                                  |
| ------------------------ | ------------------------------------------------ |
| `app/config.py`          | Configuración desde el entorno                   |
| `app/poller.py`          | Cliente HTTP (httpx) del endpoint OData          |
| `app/xml_parser.py`      | Extracción de records (JSON/XML) + mapeo a Firestore |
| `app/normalizer.py`      | Normalización Unicode NFC (recursiva) — intacto  |
| `app/firestore_writer.py`| Upsert atómico + server Timestamps — intacto     |
| `app/firebase_client.py` | Init del Admin SDK (SA JSON o ADC automático)    |
| `app/processor.py`       | Orquesta un ciclo: fetch → parse → upsert        |
| `app/main.py`            | Entrypoint: bucle de polling + apagado limpio    |

---

## Autenticación con Firebase

El worker soporta **dos estrategias de autenticación**, seleccionada
automáticamente según el entorno:

| Entorno | Mecanismo | ¿JSON necesario? |
| ------- | --------- | ---------------- |
| Local / Docker propio | Service Account JSON montado como volumen | Sí |
| Cloud Run / GKE / GCE | Application Default Credentials (ADC) | **No** |

Si el archivo JSON existe en la ruta configurada, se usa. Si no existe, el SDK
confía en las credenciales del entorno GCP (metadata server). No hay que cambiar
código ni variables entre entornos.

---

## Despliegue local (Docker Compose)

### Paso 1 — Configurar el `.env`

```bash
cp .env.example .env
```

Define como mínimo:

| Variable | Descripción | Ejemplo |
| -------- | ----------- | ------- |
| `ODATA_ENDPOINT` | URL del endpoint OData (vía túnel) | `http://localhost:8080/sap/opu/odata/sap/ZCIDYT_SRV/AdmisionSet` |
| `FIREBASE_PROJECT_ID` | ID del proyecto de Firebase | `cidyt-prod` |
| `GOOGLE_APPLICATION_CREDENTIALS_HOST` | Ruta en el host al `.json` de la Service Account | `/etc/cidyt/secrets/firebase-sa.json` |
| `POLL_INTERVAL_MINUTES` | Frecuencia de polling | `5` |

Autenticación de la API SAP (opcional, la red la asegura el túnel):
`ODATA_AUTH_TYPE` = `none` \| `basic` \| `bearer` con sus credenciales.

### Paso 2 — Ubicar el `.json` de la Service Account

Descarga la clave desde la consola de Firebase (**Configuración del proyecto →
Cuentas de servicio → Generar nueva clave privada**) y colócala en el host en la
ruta de `GOOGLE_APPLICATION_CREDENTIALS_HOST`. Se monta en `/app/sa.json` en
modo **solo lectura** (`:ro`); nunca entra a la imagen ni al repo.

```bash
mkdir -p /etc/cidyt/secrets
mv ~/Downloads/<proyecto>-firebase-adminsdk-*.json /etc/cidyt/secrets/firebase-sa.json
chmod 600 /etc/cidyt/secrets/firebase-sa.json
```

### Paso 3 — Desplegar y monitorear

```bash
docker compose up -d --build      # construir y levantar
docker compose logs -f            # monitorear (incluye stack traces)
docker compose down               # detener
```

---

## Despliegue en Google Cloud Run

Cuando el contenedor corre en infraestructura de Google, **no se necesita JSON
ni volumen**. El Firebase Admin SDK se autentica automáticamente vía ADC.

### Paso 1 — Construir y subir la imagen

```bash
# Desde sap-integration-service/
gcloud builds submit --tag gcr.io/<PROJECT_ID>/sap-integration-worker
```

### Paso 2 — Desplegar el servicio

```bash
gcloud run deploy sap-integration-worker \
  --image gcr.io/<PROJECT_ID>/sap-integration-worker \
  --region <REGION> \
  --service-account <SA_EMAIL> \
  --set-env-vars "ODATA_ENDPOINT=<url>,FIREBASE_PROJECT_ID=<id>,POLL_INTERVAL_MINUTES=5" \
  --no-allow-unauthenticated
```

> **`<SA_EMAIL>`** debe ser una service account con el rol
> `roles/datastore.user` (o `roles/firebase.admin` si necesita más permisos).
> Puede ser la misma de Firebase Admin SDK:
> `firebase-adminsdk-*@<PROJECT_ID>.iam.gserviceaccount.com`.

### Paso 3 — Variables de entorno

Configura las mismas variables que en `.env.example` **excepto**:
- `GOOGLE_APPLICATION_CREDENTIALS_HOST` → **no se define** (no hay JSON).
- `GOOGLE_APPLICATION_CREDENTIALS` → **no se define** (ADC lo resuelve solo).

Las variables de OData y polling se configuran directamente en Cloud Run
(consola o `--set-env-vars`).

---

## Formato de respuesta soportado

El parser es **agnóstico al formato** y se decide según el `Content-Type`:

- **JSON OData v2**: `{"d": {"results": [ ... ]}}` o `{"d": { ... }}`
- **JSON OData v4**: `{"value": [ ... ]}`
- **XML**: envelope `MT_i151_AdAmbCUP_CiDYT_SFTP` con uno o varios `<patient>`,
  o feed con campos `Pat*` dispersos.

Cada record debe contener los campos `Pat*`. Un record inválido (sin
`PatNumHist`, `PatNombre1` o `PatApePat`) se omite con un warning sin abortar
el resto del lote.

## Mapeo de campos → Firestore

| Campo OData/XML | Destino |
| --------------- | ------- |
| `PatNumHist` | `pacientes/{id}` · `numHistoria` |
| `PatNoCita` | `seguimientos/{id}` · `noCita` |
| `PatNombre1` | `paciente.nombre1` |
| `PatApePat` | `paciente.apePaterno` |
| `PatApeMat` | `paciente.apeMaterno` |
| `PatGenero` | `paciente.sexo` |
| `PatFechaNac` | `paciente.fechaNacimiento` (Timestamp) |
| `PatCteId` | `seguimiento.empresaId` |
| `PatDescCte` | `seguimiento.empresaNombre` |
| `PatEpisodio` | `seguimiento.episodio` |
| `PatPaqId` | `seguimiento.paqueteId` |
| `PatDesPaq` | `seguimiento.paqueteDescripcion` |
| `PatFechaCita` | `seguimiento.fechaCita` (Timestamp) |

Campos de auditoría (`createdAt`, `fechaIngresoUtc`) usan `SERVER_TIMESTAMP`;
`createdBy` / `updatedBy` usan `AUDIT_ACTOR` (`sap-integration`).

## Garantías de comportamiento

- **Idempotencia**: el `id` del documento se deriva de la historia clínica y de
  la cita; reprocesar el mismo record no duplica (`merge=True`).
- **Atomicidad**: paciente y seguimiento se escriben en un único `WriteBatch`.
- **Resiliencia**: un fallo de red/parseo en un ciclo, o un record inválido, no
  tumba el worker; se registra el stack trace y el polling continúa.
- **Apagado limpio**: responde a `SIGTERM`/`SIGINT` cortando el intervalo de
  espera de inmediato.
