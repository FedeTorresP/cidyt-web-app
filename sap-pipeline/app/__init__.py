"""Pipeline SAP → Firestore — IPadCIDyT.

Reemplaza los scripts PHP legacy (CargaXml, CargaDatosPacInterface,
insertpackage, CreaPaquete) que leían XML y escribían en MySQL.
Ahora recibe JSON de SAP y escribe en Firestore.
"""

__version__ = "0.1.0"
