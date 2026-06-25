#!/usr/bin/env bash
#
# Crea el conector de Serverless VPC Access en la VPC compartida
# `core-red-compartida` para que la Cloud Function pueda alcanzar el
# sap-pipeline On-Premise por red privada.
#
# En una Shared VPC el conector se crea en el HOST project y la función (en el
# service project) lo referencia con el recurso completo.
#
# Requisitos: gcloud autenticado y el API vpcaccess.googleapis.com habilitado.
#
# Uso:
#   HOST_PROJECT_ID=mi-host-project \
#   SERVICE_PROJECT_ID=ipad-cidyt \
#   SUBNET=core-red-compartida-conn-subnet \
#   ./setup_vpc_connector.sh
#
set -euo pipefail

HOST_PROJECT_ID="${HOST_PROJECT_ID:?Define HOST_PROJECT_ID (proyecto host de la Shared VPC)}"
SERVICE_PROJECT_ID="${SERVICE_PROJECT_ID:-ipad-cidyt}"
REGION="${REGION:-us-central1}"
NETWORK="${NETWORK:-core-red-compartida}"
CONNECTOR_NAME="${CONNECTOR_NAME:-core-red-compartida-conn}"

# Opción A (recomendada en Shared VPC): subnet /28 dedicada ya creada en el host.
SUBNET="${SUBNET:-}"
# Opción B: dejar que el conector cree su propio rango /28 sobre la red.
IP_RANGE="${IP_RANGE:-10.8.0.0/28}"

echo ">> Habilitando API de Serverless VPC Access en ${HOST_PROJECT_ID}..."
gcloud services enable vpcaccess.googleapis.com --project="${HOST_PROJECT_ID}"

echo ">> Creando conector ${CONNECTOR_NAME} en ${HOST_PROJECT_ID} (${REGION})..."
if [[ -n "${SUBNET}" ]]; then
  gcloud compute networks vpc-access connectors create "${CONNECTOR_NAME}" \
    --project="${HOST_PROJECT_ID}" \
    --region="${REGION}" \
    --subnet="${SUBNET}" \
    --subnet-project="${HOST_PROJECT_ID}" \
    --min-instances=2 \
    --max-instances=10 \
    --machine-type=e2-micro
else
  gcloud compute networks vpc-access connectors create "${CONNECTOR_NAME}" \
    --project="${HOST_PROJECT_ID}" \
    --region="${REGION}" \
    --network="${NETWORK}" \
    --range="${IP_RANGE}" \
    --min-instances=2 \
    --max-instances=10 \
    --machine-type=e2-micro
fi

echo ">> Otorgando rol vpcaccess.user a las SAs del service project ${SERVICE_PROJECT_ID}..."
SERVICE_PROJECT_NUMBER="$(gcloud projects describe "${SERVICE_PROJECT_ID}" --format='value(projectNumber)')"

# SA del agente de servicio de Cloud Functions/Run (gen2) y SA de compute por defecto.
for SA in \
  "service-${SERVICE_PROJECT_NUMBER}@gcf-admin-robot.iam.gserviceaccount.com" \
  "${SERVICE_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  "service-${SERVICE_PROJECT_NUMBER}@serverless-robot-prod.iam.gserviceaccount.com"; do
  gcloud projects add-iam-policy-binding "${HOST_PROJECT_ID}" \
    --member="serviceAccount:${SA}" \
    --role="roles/vpcaccess.user" \
    --condition=None || true
done

echo
echo "Conector listo. Referencia para functions/.env (VPC_CONNECTOR):"
echo "  projects/${HOST_PROJECT_ID}/locations/${REGION}/connectors/${CONNECTOR_NAME}"
