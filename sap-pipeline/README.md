# SAP → Firestore Pipeline (IPadCIDyT)

Servicio Python que reemplaza el pipeline PHP legacy. SAP ahora envía **JSON**
(en lugar de XML) a una API FastAPI, que valida los datos y los escribe en
**Firestore** (en lugar de MySQL).

## Equivalencia con el legacy

| Script PHP legacy | Reemplazado por |
|-------------------|-----------------|
| `CargaXml.php` / `CargaXml2.php` | `POST /patients` (dedup + alta interface) |
| `CargaDatosPacInterface.php` / `...2.php` | `POST /patients` (alta paciente, seguimiento, val_corporal, estudios) |
| `insertpackage.php` | `POST /packages` |
| `CreaPaquete.php` | `POST /packages` (genera `paquete_det` 1..N) |

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/patients` | Ingesta de pacientes/citas |
| `POST` | `/packages` | Ingesta de paquetes + prestaciones |
| `GET`  | `/health` | Healthcheck |
| `GET`  | `/docs` | Swagger UI |

## Estructura

```
sap-pipeline/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings (.env) — nombres de colecciones configurables
│   ├── firebase.py          # Init Firebase Admin + cliente Firestore
│   ├── core/datetime_mx.py  # Fechas/horas en America/Mexico_City
│   ├── models/              # Esquemas Pydantic del JSON de SAP
│   ├── services/            # Lógica de escritura a Firestore
│   └── routers/             # Endpoints HTTP
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Puesta en marcha (local)

```bash
cd sap-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # edita los valores
# coloca tu serviceAccountKey.json en la raíz
uvicorn app.main:app --reload --port 8000
```

Abre http://localhost:8000/docs

## Docker

Como decidieron **no** usar Cloud Run/Lambda (costo por invocaciones frecuentes),
el servicio corre como contenedor de larga duración:

```bash
docker compose up -d --build
```

## Formato JSON esperado

### Pacientes — `POST /patients`

Acepta los nombres originales de SAP (`PatNoCita`, ...) o los nombres limpios.

```json
{
  "patients": [
    {
      "PatNoCita": "45821",
      "PatFechaCita": "2026-06-16",
      "PatEpisodio": "EP-0099",
      "PatNumHist": "100234",
      "PatNombre1": "Juan",
      "PatNombre2": "Carlos",
      "PatApePat": "López",
      "PatApeMat": "García",
      "PatGenero": "M",
      "PatFechaNac": "1985-03-20",
      "PatCteId": "UDC-001",
      "PatDescCte": "Empresa Ejemplo S.A.",
      "PatPaqId": "UDC-267-0001",
      "PatDesPaq": "Paquete Ejecutivo"
    }
  ]
}
```

### Paquetes — `POST /packages`

```json
{
  "packages": [
    {
      "CeSanitario": "CS-01",
      "CatPrestaciones": "CAT-A",
      "Paquete": "UDC-267-0001",
      "DescPaq": "Paquete Ejecutivo",
      "Activo": true,
      "prestaciones": [
        { "Prestacion": "PR-001", "DescPrest": "Biometría Hemática", "Posicion": 1, "Cantidad": 1, "Validezde": "01.01.2026", "Valideza": "31.12.2026" },
        { "Prestacion": "PR-002", "DescPrest": "Química Sanguínea",  "Posicion": 2, "Cantidad": 1, "Validezde": "01.01.2026", "Valideza": "31.12.2026" }
      ]
    }
  ]
}
```

> Las fechas `dd.mm.yyyy` se normalizan a `yyyy-mm-dd` (igual que el legacy).

## Notas de implementación

- **Dedup de citas:** el doc id de la colección `interface_ipad` es el `No_Cita`,
  así la deduplicación es un simple `get()` (equivale a `ExisteCita`).
- **Escritura atómica:** cada paciente se escribe con un `batch` de Firestore
  (paciente + seguimiento + val_corporal + estudios_realizar + interface).
- **Catálogo de estudios:** se leen de la colección `estudios` donde
  `mostrar_interface == true` y `activo == true` (equivale al `SELECT ... estudio`).
- **Nombres de colecciones:** todos configurables vía `.env` para encajar con el
  esquema que ya definiste en el frontend.
- **Valores por defecto del seguimiento** (entidad=10, turno=1, horario=1,
  medico=0) heredados del legacy y configurables en `.env`.

## Pendientes (a definir contigo)

- Autenticación del endpoint para SAP (API key / mTLS / red privada).
- Confirmar nombres exactos de colecciones y campos contra el frontend.
- Estrategia de catálogo de estudios (¿1..20 fijo como el legacy, o por flag?).
