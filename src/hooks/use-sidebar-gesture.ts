import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PanInfo } from 'framer-motion'
import { SIDEBAR_WIDTH, sidebarOverlayOpacity } from '@/lib/motion'

export const SIDEBAR_EDGE_ZONE = 24
const TOGGLE_LOCK_MS = 200
const OPEN_THRESHOLD_RATIO = 0.4
const OPEN_VELOCITY = 400
const CLOSE_OFFSET = -80
const CLOSE_VELOCITY = -400

interface UseSidebarGestureOptions {
  overlayMode: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function useSidebarGesture({ overlayMode, open, onOpenChange }: UseSidebarGestureOptions) {
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const lockUntilRef = useRef(0)
  const edgeStartXRef = useRef(0)
  const edgeStartTimeRef = useRef(0)
  const edgePointerIdRef = useRef<number | null>(null)

  const isLocked = () => Date.now() < lockUntilRef.current

  const acquireLock = useCallback(() => {
    lockUntilRef.current = Date.now() + TOGGLE_LOCK_MS
  }, [])

  const snapOpen = useCallback(
    (shouldOpen: boolean) => {
      if (isLocked()) return
      acquireLock()
      setDragOffset(null)
      setIsDragging(false)
      onOpenChange(shouldOpen)
    },
    [onOpenChange, acquireLock],
  )

  const getSidebarX = (): number => {
    if (!overlayMode) return open ? 0 : -SIDEBAR_WIDTH
    if (dragOffset === null) return open ? 0 : -SIDEBAR_WIDTH
    if (open) {
      return Math.max(-SIDEBAR_WIDTH, Math.min(0, dragOffset))
    }
    return Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + dragOffset)
  }

  const sidebarX = getSidebarX()
  const progress = (sidebarX + SIDEBAR_WIDTH) / SIDEBAR_WIDTH
  const showOverlay = overlayMode && (open || isDragging || dragOffset !== null)
  const overlayOpacity = showOverlay ? sidebarOverlayOpacity(progress) : 0

  const handleSidebarDrag = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (!overlayMode || !open) return
      setIsDragging(true)
      setDragOffset(info.offset.x)
    },
    [overlayMode, open],
  )

  const handleSidebarDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (!overlayMode) return
      setIsDragging(false)
      const shouldClose = info.offset.x < CLOSE_OFFSET || info.velocity.x < CLOSE_VELOCITY
      setDragOffset(null)
      snapOpen(!shouldClose)
    },
    [overlayMode, snapOpen],
  )

  const finishEdgeGesture = useCallback(
    (clientX: number) => {
      if (edgePointerIdRef.current === null) return
      edgePointerIdRef.current = null
      setIsDragging(false)
      const delta = clientX - edgeStartXRef.current
      const dt = Math.max(Date.now() - edgeStartTimeRef.current, 1)
      const velocity = (delta / dt) * 1000
      const shouldOpen = delta > SIDEBAR_WIDTH * OPEN_THRESHOLD_RATIO || velocity > OPEN_VELOCITY
      setDragOffset(null)
      if (shouldOpen) snapOpen(true)
    },
    [snapOpen],
  )

  const handleEdgePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!overlayMode || open || isLocked()) return
      edgePointerIdRef.current = e.pointerId
      edgeStartXRef.current = e.clientX
      edgeStartTimeRef.current = Date.now()
      setIsDragging(true)
      setDragOffset(0)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [overlayMode, open],
  )

  const handleEdgePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (edgePointerIdRef.current !== e.pointerId || open) return
      const delta = e.clientX - edgeStartXRef.current
      if (delta > 0) {
        setDragOffset(Math.min(delta, SIDEBAR_WIDTH))
      }
    },
    [open],
  )

  const handleEdgePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (edgePointerIdRef.current !== e.pointerId) return
      e.currentTarget.releasePointerCapture(e.pointerId)
      finishEdgeGesture(e.clientX)
    },
    [finishEdgeGesture],
  )

  const handleEdgePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (edgePointerIdRef.current !== e.pointerId) return
      finishEdgeGesture(e.clientX)
    },
    [finishEdgeGesture],
  )

  const resetDrag = useCallback(() => {
    setDragOffset(null)
    setIsDragging(false)
    edgePointerIdRef.current = null
  }, [])

  return {
    sidebarX,
    overlayOpacity,
    isDragging,
    showOverlay,
    handleSidebarDrag,
    handleSidebarDragEnd,
    handleEdgePointerDown,
    handleEdgePointerMove,
    handleEdgePointerUp,
    handleEdgePointerCancel,
    resetDrag,
    acquireLock,
    isLocked,
  }
}
