"""Prueba de integración del pipeline con los mensajes REALES de SAP.

No requiere credenciales de Firebase: inyecta un Firestore en memoria (fake)
para ejercitar router -> modelos -> servicio -> escritura, usando los archivos
de `test_api/received_messages/` tal cual los envió SAP.

Uso:
    .venv/bin/python scripts/integration_check.py
"""

from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

RECEIVED = ROOT.parent / "test_api" / "received_messages"


# --------------------------------------------------------------------------- #
# Firestore falso en memoria (solo lo que usan los servicios)
# --------------------------------------------------------------------------- #
class FakeSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeDocRef:
    def __init__(self, store, collection, doc_id):
        self._store = store
        self._collection = collection
        self.id = doc_id

    def get(self) -> FakeSnapshot:
        data = self._store.data.get(self._collection, {}).get(self.id)
        return FakeSnapshot(self.id, data)

    def set(self, data, merge: bool = False) -> None:
        col = self._store.data.setdefault(self._collection, {})
        if merge and col.get(self.id):
            col[self.id] = {**col[self.id], **data}
        else:
            col[self.id] = dict(data)


class FakeQuery:
    def __init__(self, store, collection, filters, limit_n=None):
        self._store = store
        self._collection = collection
        self._filters = filters
        self._limit = limit_n

    def where(self, field, op, value):
        return FakeQuery(
            self._store, self._collection, self._filters + [(field, op, value)], self._limit
        )

    def limit(self, n):
        return FakeQuery(self._store, self._collection, self._filters, n)

    def stream(self):
        col = self._store.data.get(self._collection, {})
        out = []
        for doc_id, data in col.items():
            if data is None:
                continue
            if all(data.get(f) == v for f, op, v in self._filters if op == "=="):
                out.append(FakeSnapshot(doc_id, data))
        return iter(out[: self._limit] if self._limit else out)


class FakeCollection:
    def __init__(self, store, name):
        self._store = store
        self._name = name

    def document(self, doc_id=None):
        if doc_id is None:
            doc_id = f"auto_{next(self._store.counter)}"
        return FakeDocRef(self._store, self._name, doc_id)

    def where(self, field, op, value):
        return FakeQuery(self._store, self._name, [(field, op, value)])

    def stream(self):
        return FakeQuery(self._store, self._name, []).stream()


class FakeBatch:
    def __init__(self, store):
        self._store = store
        self._ops = []

    def set(self, ref, data, merge: bool = False):
        self._ops.append((ref, data, merge))

    def commit(self):
        for ref, data, merge in self._ops:
            ref.set(data, merge=merge)


class FakeFirestore:
    def __init__(self):
        self.data: dict = {}
        self.counter = itertools.count(1)

    def collection(self, name):
        return FakeCollection(self, name)

    def batch(self):
        return FakeBatch(self)


# --------------------------------------------------------------------------- #
# Montaje del fake + seed del catálogo de estudios
# --------------------------------------------------------------------------- #
fake = FakeFirestore()
fake.data["estudios"] = {
    "E1": {"estudio_id": "E1", "nombre": "Biometría Hemática", "mostrar_interface": True, "activo": True},
    "E2": {"estudio_id": "E2", "nombre": "Química Sanguínea", "mostrar_interface": True, "activo": True},
    "E3": {"estudio_id": "E3", "nombre": "Inactivo", "mostrar_interface": True, "activo": False},
}

from app.services import package_service, patient_service  # noqa: E402

patient_service.get_db = lambda: fake
package_service.get_db = lambda: fake

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def _load(name: str) -> dict:
    return json.loads((RECEIVED / name).read_text(encoding="utf-8"))


def _post(payload: dict):
    return client.post("/patients", json=payload)


def banner(txt: str) -> None:
    print("\n" + "=" * 70 + f"\n{txt}\n" + "=" * 70)


# --------------------------------------------------------------------------- #
# 1) Mensaje REAL completo de SAP (Insertpatient)
# --------------------------------------------------------------------------- #
banner("1) Mensaje real de SAP — Insertpatient (msg_20260625)")
real = _load("msg_20260625_113220_441075.json")
r = _post(real)
print("HTTP", r.status_code)
print(json.dumps(r.json(), indent=2, ensure_ascii=False))

iface = fake.data.get("interface_ipad", {}).get("0000211960")
print("\ninterface_ipad[0000211960]:")
print(json.dumps(iface, indent=2, ensure_ascii=False))
print("\nfecha_cita normalizada ->", iface["fecha_cita"], "(esperado 2026-06-25)")
print("empresa creada con cte_id vacío?:", "empresas" in fake.data,
      "(esperado False)")
print("estudios_realizar creados:", len(fake.data.get("estudios_realizar", {})),
      "(esperado 2, el inactivo se omite)")

# --------------------------------------------------------------------------- #
# 2) Dedup: reenviar el mismo mensaje
# --------------------------------------------------------------------------- #
banner("2) Reenvío del mismo Insertpatient (dedup por No_Cita)")
r = _post(real)
print("HTTP", r.status_code, "->", r.json()["resultados"][0]["status"], "(esperado omitido)")

# --------------------------------------------------------------------------- #
# 3) Update sobre la cita existente
# --------------------------------------------------------------------------- #
banner("3) Updatepatient sobre la misma cita")
upd = json.loads(json.dumps(real))
upd["message"]["event"] = "Updatepatient"
upd["patient"]["patNombre1"] = "NOMBRE EDITADO"
r = _post(upd)
print("HTTP", r.status_code, "operacion:", r.json()["operacion"])
print("status:", r.json()["resultados"][0]["status"], "(esperado actualizado)")
print("interface nombre1 ahora:", fake.data["interface_ipad"]["0000211960"]["nombre1"])

# --------------------------------------------------------------------------- #
# 4) Delete (baja lógica)
# --------------------------------------------------------------------------- #
banner("4) Deletepatient (baja lógica)")
dele = json.loads(json.dumps(real))
dele["message"]["event"] = "Deletepatient"
r = _post(dele)
print("HTTP", r.status_code, "operacion:", r.json()["operacion"])
print("status:", r.json()["resultados"][0]["status"], "(esperado eliminado)")
print("interface activo:", fake.data["interface_ipad"]["0000211960"]["activo"], "(esperado False)")

# --------------------------------------------------------------------------- #
# 5) Formato lote propio + PascalCase del XML
# --------------------------------------------------------------------------- #
banner("5) Lote propio {patients:[...]} con nombres PascalCase")
lote = {"patients": [{"PatNoCita": "999", "PatNombre1": "Lote", "PatApePat": "Test",
                      "PatPaqId": "DT0001", "PatFechaCita": "30.01.2026"}]}
r = _post(lote)
print("HTTP", r.status_code, "->", r.json()["resultados"][0]["status"])
print("fecha_cita (dd.mm.yyyy -> iso):",
      fake.data["interface_ipad"]["999"]["fecha_cita"], "(esperado 2026-01-30)")

# --------------------------------------------------------------------------- #
# 6) Mensajes parciales (curls de prueba, no salida real de SAP)
# --------------------------------------------------------------------------- #
banner("6) Mensajes de prueba incompletos (deben dar 422)")
for name in ("msg_20260623_184502_764389.json", "msg_20260624_170843_402011.json"):
    r = _post(_load(name))
    faltan = [e["loc"][-1] for e in r.json().get("detail", [])] if r.status_code == 422 else []
    print(f"{name}: HTTP {r.status_code} faltan={faltan}")

# --------------------------------------------------------------------------- #
# 7) Paquetes: envelope de SAP + camelCase + fechas
# --------------------------------------------------------------------------- #
banner("7) Paquetes {message, package} con camelCase y fechas")
pkg = {
    "message": {"type": "Import", "event": "Insertpackage", "messageid": "PKG1"},
    "package": {
        "ceSanitario": "CS-01",
        "paquete": "DT0007",
        "descPaq": "Check Up",
        "activo": "1",
        "prestaciones": [
            {"prestacion": "PR-001", "descPrest": "Biometría", "posicion": 1,
             "cantidad": 1, "validezde": "01.01.2026", "valideza": "31.12.2026"},
        ],
    },
}
r = client.post("/packages", json=pkg)
print("HTTP", r.status_code, "operacion:", r.json()["operacion"],
      "status:", r.json()["resultados"][0]["status"])
prest = fake.data["prestaciones"]["PR-001"]
print("prestacion validez_de (dd.mm.yyyy -> iso):", prest["validez_de"], "(esperado 2026-01-01)")
print("paquete activo ('1' -> bool):", fake.data["paquetes"]["DT0007"]["activo"])

banner("FIN — prueba de integración completada")
