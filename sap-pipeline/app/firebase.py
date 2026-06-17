"""Inicialización del Firebase Admin SDK y acceso al cliente Firestore.

Usa inicialización perezosa (lazy) + singleton para que la app pueda
arrancar aunque las credenciales se resuelvan en tiempo de ejecución.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client

from app.config import get_settings

logger = logging.getLogger(__name__)


def _init_app() -> firebase_admin.App:
    """Inicializa (una sola vez) la app de Firebase Admin."""
    if firebase_admin._apps:  # ya inicializada
        return firebase_admin.get_app()

    settings = get_settings()
    cred_path = settings.firebase_credentials_path

    if not os.path.exists(cred_path):
        raise FileNotFoundError(
            f"No se encontró el service account en '{cred_path}'. "
            "Configura FIREBASE_CREDENTIALS_PATH en tu .env."
        )

    cred = credentials.Certificate(cred_path)
    options = {}
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id

    app = firebase_admin.initialize_app(cred, options or None)
    logger.info("Firebase Admin inicializado (proyecto: %s)", app.project_id)
    return app


@lru_cache
def get_db() -> Client:
    """Devuelve el cliente Firestore (singleton)."""
    _init_app()
    return firestore.client()
