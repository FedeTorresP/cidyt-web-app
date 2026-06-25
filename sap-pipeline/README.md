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

SAP envía **un paciente por POST**, envuelto en `message` + `patient`. Este es
el formato real que produce el método ABAP `SEND2PO2` (la primera letra de cada
campo va en minúscula porque así serializa el XML a JSON):

```json
{
  "message": { "type": "Import", "event": "Insertpatient", "messageid": "CIDYT0000211960" },
  "patient": {
    "patNoCita": "0000211960",
    "patFechaCita": "2026/06/25",
    "patEpisodio": "1000178746",
    "patNumHist": "1000268635",
    "patNombre1": "SASEUM",
    "patApePat": "BECERRA",
    "patApeMat": "",
    "patGenero": "M",
    "patFechaNac": "2019/08/10",
    "patCteId": "",
    "patDescCte": " ",
    "patPaqId": "DT0007",
    "patDesPaq": "CHECK UP ALEN C"
  }
}
```

Compatibilidad de formatos:

- **Nombres de campo:** se aceptan las tres formas — `patNoCita` (real de SAP),
  `PatNoCita` (PascalCase del XML) y `no_cita` (interno) — vía `AliasChoices`.
- **Operación:** se deriva de `message.event`:
  `Insert*` → alta, `Update*` → actualización (upsert), `Delete*` → baja lógica
  (`activo=false`). Si `event` falta o no se reconoce, se asume alta.
- **Fechas:** `yyyy/mm/dd` (y `dd.mm.yyyy`) se normalizan a `yyyy-mm-dd`.
- **Empresa opcional:** si `patCteId` viene vacío, no se crea empresa con alias
  vacío; el seguimiento queda con `empresa_id=""`.
- **Lote propio:** también se acepta `{"patients": [ ... ]}` para cargas masivas.

### Paquetes — `POST /packages`

Acepta el envoltorio de SAP (`{"message": {...}, "package": {...}}`) o el lote
propio (`{"packages": [ ... ]}`). Los nombres aceptan camelCase de SAP
(`prestacion`), PascalCase (`Prestacion`) y el nombre interno.

```json
{
  "message": { "type": "Import", "event": "Insertpackage", "messageid": "..." },
  "package": {
    "ceSanitario": "CS-01",
    "catPrestaciones": "CAT-A",
    "paquete": "UDC-267-0001",
    "descPaq": "Paquete Ejecutivo",
    "activo": true,
    "prestaciones": [
      { "prestacion": "PR-001", "descPrest": "Biometría Hemática", "posicion": 1, "cantidad": 1, "validezde": "01.01.2026", "valideza": "31.12.2026" },
      { "prestacion": "PR-002", "descPrest": "Química Sanguínea",  "posicion": 2, "cantidad": 1, "validezde": "01.01.2026", "valideza": "31.12.2026" }
    ]
  }
}
```

> Las fechas `dd.mm.yyyy` y `yyyy/mm/dd` se normalizan a `yyyy-mm-dd`.

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
