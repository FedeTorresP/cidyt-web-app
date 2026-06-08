import { doc, collection, Timestamp, type Transaction } from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'

export interface AuditEntry {
  actorUserId: string
  eventType: string
  entityType: string
  entityId: string
  beforeState: string | null
  afterState: string | null
}

/**
 * Agrega un registro de auditoría dentro de una transacción Firestore.
 * Mantiene atomicidad: mutación + audit en la misma transacción.
 */
export function addAuditWithinTransaction(
  transaction: Transaction,
  entry: AuditEntry,
): void {
  const db = getFirebaseFirestore()
  const auditCollection = collection(db, 'audit_log')
  const newRef = doc(auditCollection)

  transaction.set(newRef, {
    ...entry,
    timestamp: Timestamp.now(),
    createdAt: Timestamp.now(),
  })
}
