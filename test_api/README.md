# API de pruebas - Recepción de mensajes SEND2PO2

API mínima para **probar localmente** el envío JSON del método ABAP `SEND2PO2`.
Recibe cualquier `POST`, guarda el cuerpo en `received_messages/` y responde `200 OK`.

> Uso exclusivo para pruebas. No usar en producción (sin auth, sin TLS).

## Requisitos

- Python 3.9+

## Instalación y arranque

```bash
cd test_api
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

La API queda escuchando en `http://0.0.0.0:8000`:

- `POST /` (o cualquier ruta, p. ej. `/cidyt/admision`) → guarda el mensaje.
- `GET /health` → verifica que está arriba.

Los mensajes se guardan en `test_api/received_messages/` con nombre
`msg_AAAAMMDD_HHMMSS_microsegundos.json` (o `.txt` si el cuerpo no es JSON válido).

## Probar sin SAP (con curl)

```bash
curl -X POST http://localhost:8000/cidyt/admision \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"message":{"type":"Import","event":"Insertpatient","messageId":"CIDYT123"},"patient":{"patNoCita":"123","patNombre1":"JUAN"}}'
```

## Conexión desde SAP ECC (SM59)

Crea un destino RFC tipo **G (HTTP Connection to External Server)** con:

- **Host objetivo:** la IP de tu equipo en la red local (no `localhost`; el
  servidor SAP debe poder alcanzarte). Averíguala con `ipconfig getifaddr en0` (macOS)
  o `ipconfig` (Windows).
- **Puerto de servicio:** `8000`
- **Path prefix:** la ruta que quieras, p. ej. `/cidyt/admision`

Ese nombre de destino debe coincidir con la constante `lc_dest` del método
(`ZCIDYT_REST` por defecto).

> Si SAP corre en otro equipo/red y no puede alcanzar tu máquina directamente,
> considera exponer el puerto con una herramienta de túnel para pruebas.
