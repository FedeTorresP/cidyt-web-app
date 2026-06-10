# =============================================================================
# SAP Integration Worker — polling OData → Firestore
# Base: python:3.12-slim (NO alpine; lxml y grpcio carecen de wheels para musl)
# =============================================================================
FROM python:3.12-slim AS base

# Evita prompts de apt y buffers de stdout (logs en tiempo real en el contenedor)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# UID/GID fijos del usuario de la aplicación (no-root).
ARG APP_UID=10001
ARG APP_GID=10001

# Dependencias de sistema mínimas para usar lxml de forma robusta.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libxml2 \
        libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependencias primero para aprovechar la cache de capas de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código de la aplicación
COPY app/ ./app/

# Usuario sin privilegios. El worker no necesita acceso a volúmenes de archivos;
# solo lee la Service Account (montada en :ro) y hace red saliente al túnel.
RUN groupadd --gid "${APP_GID}" appuser \
    && useradd --create-home --uid "${APP_UID}" --gid "${APP_GID}" appuser \
    && chown -R appuser:appuser /app
USER appuser

# El worker no expone puertos: hace polling saliente y escribe en Firestore.
ENTRYPOINT ["python", "-m", "app.main"]
