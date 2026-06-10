"""
Inicialización del Firebase Admin SDK mediante Service Account.

Mantiene un singleton del cliente de Firestore para reutilizar la conexión
a lo largo de la vida del daemon.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client as FirestoreClient

from .config import Settings

logger = logging.getLogger(__name__)

_firestore_client: FirestoreClient | None = None


def init_firebase(settings: Settings) -> FirestoreClient:
    """
    Inicializa la app de Firebase Admin (idempotente) y devuelve el cliente
    de Firestore.

    Estrategia de autenticación:
      1. Si existe el JSON de Service Account → lo usa (local / Docker propio).
      2. Si no existe → confía en Application Default Credentials (ADC), que
         funciona automáticamente en Cloud Run, GKE, GCE, etc.
    """
    global _firestore_client

    if _firestore_client is not None:
        return _firestore_client

    if not firebase_admin._apps:  # evita doble inicialización
        cred_path = Path(settings.google_application_credentials)

        if cred_path.is_file():
            # Entorno local / Docker con volumen montado.
            os.environ.setdefault(
                "GOOGLE_APPLICATION_CREDENTIALS", str(cred_path)
            )
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(
                cred,
                {"projectId": settings.firebase_project_id},
            )
            logger.info(
                "Firebase Admin inicializado con Service Account JSON "
                "para el proyecto %s",
                settings.firebase_project_id,
            )
        else:
            # Entorno GCP (Cloud Run, GKE, GCE): ADC automático.
            firebase_admin.initialize_app(
                options={"projectId": settings.firebase_project_id},
            )
            logger.info(
                "Firebase Admin inicializado con Application Default "
                "Credentials (ADC) para el proyecto %s",
                settings.firebase_project_id,
            )

    _firestore_client = firestore.client()
    return _firestore_client
