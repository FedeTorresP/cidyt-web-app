import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase'
import { addAuditWithinTransaction } from '@/services/audit'
import { useAuth } from './use-auth'

export interface FilaCaja {
  facturaId: string
  seguimientoId: string
  pacienteNombre: string
  empresaNombre: string | null
  facturaNo: number | null
  fechaIngresoLocal: Date | null
}

function buildPacienteNombre(data: Record<string, unknown>): string {
  const parts: string[] = []
  if (data.nombre1) parts.push(String(data.nombre1))
  if (data.nombre2) parts.push(String(data.nombre2))
  if (data.apePaterno) parts.push(String(data.apePaterno))
  if (data.apeMaterno) parts.push(String(data.apeMaterno))
  return parts.join(' ')
}

async function fetchFacturas(startUtc: Date, endUtc: Date): Promise<FilaCaja[]> {
  const db = getFirebaseFirestore()
  const facturasQuery = query(
    collection(db, 'facturas'),
    where('activo', '==', true),
    where('fechaIngresoUtc', '>=', Timestamp.fromDate(startUtc)),
    where('fechaIngresoUtc', '<=', Timestamp.fromDate(endUtc)),
    orderBy('fechaIngresoUtc', 'asc'),
  )
  const snapshot = await getDocs(facturasQuery)

  const results: FilaCaja[] = await Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data()

      let pacienteNombre = ''
      if (data.seguimientoId) {
        const segDoc = await getDoc(doc(db, 'seguimientos', data.seguimientoId))
        if (segDoc.exists()) {
          const segData = segDoc.data()!
          if (segData.pacienteId) {
            const pacDoc = await getDoc(doc(db, 'pacientes', segData.pacienteId))
            if (pacDoc.exists()) {
              pacienteNombre = buildPacienteNombre(pacDoc.data()!)
            }
          }
        }
      }

      let empresaNombre: string | null = null
      if (data.empresaId) {
        const empDoc = await getDoc(doc(db, 'empresas', data.empresaId))
        if (empDoc.exists()) {
          empresaNombre = (empDoc.data()?.nombre as string) ?? null
        }
      }

      return {
        facturaId: d.id,
        seguimientoId: data.seguimientoId ?? '',
        pacienteNombre,
        empresaNombre,
        facturaNo: data.facturaNo ?? null,
        fechaIngresoLocal: data.fechaIngresoUtc?.toDate?.() ?? null,
      }
    }),
  )

  return results
}

export function useFacturas(startUtc: Date, endUtc: Date) {
  return useQuery({
    queryKey: ['facturas', startUtc.toISOString(), endUtc.toISOString()],
    queryFn: () => fetchFacturas(startUtc, endUtc),
  })
}

export interface RegistrarFacturaInput {
  seguimientoId: string
  empresaId: string
  promotorId?: string | null
  facturaNo?: number | null
  descripcion1?: string | null
  observaciones?: string | null
}

export function useRegistrarFactura() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: RegistrarFacturaInput) => {
      if (!user) throw new Error('No hay sesión activa.')

      const db = getFirebaseFirestore()
      const newDocRef = doc(collection(db, 'facturas'))

      await runTransaction(db, async (transaction) => {
        transaction.set(newDocRef, {
          seguimientoId: input.seguimientoId,
          empresaId: input.empresaId,
          promotorId: input.promotorId ?? null,
          facturaNo: input.facturaNo ?? null,
          fechaIngresoUtc: Timestamp.now(),
          descripcion1: input.descripcion1 ?? null,
          observaciones: input.observaciones ?? null,
          activo: true,
          createdBy: user.uid,
          updatedBy: user.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })

        addAuditWithinTransaction(transaction, {
          actorUserId: user.uid,
          eventType: 'factura.alta',
          entityType: 'factura',
          entityId: newDocRef.id,
          beforeState: null,
          afterState: `seguimiento:${input.seguimientoId}, empresa:${input.empresaId}`,
        })
      })

      return newDocRef.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
    },
  })
}
