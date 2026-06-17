FROM python:3.12-slim

# Evita .pyc y fuerza stdout/stderr sin buffer (logs en tiempo real).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Instalar dependencias primero (mejor cacheo de capas).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código de la aplicación.
COPY app ./app

EXPOSE 8000

# Servidor de producción. Ajusta --workers según tu carga.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
