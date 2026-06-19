import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { loginWithEmail, logout, GENERIC_AUTH_ERROR } from '@/services/auth'
import { useAuth } from '@/hooks/use-auth'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { pageSlide } from '@/lib/motion'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   Tipos internos
   ═══════════════════════════════════════════════════════════════════════════ */

type Turno = 'MATUTINO' | 'VESPERTINO'
type LoginStep = 'credentials' | 'schedule'

/* ═══════════════════════════════════════════════════════════════════════════
   Logo corporativo Médica Sur (SVG inline del asset LogoMS1.svg)
   ═══════════════════════════════════════════════════════════════════════════ */

function CorporateLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 224 224"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M22.717625,125.076393 C25.601562,114.946541 31.305059,107.479958 40.054077,102.317253 C42.740337,100.732124 45.096073,100.366379 47.845802,102.382645 C63.553398,113.900444 79.337143,125.314537 95.117111,136.733322 C96.984077,138.084320 97.408218,139.726044 97.041550,141.941315 C93.824883,161.375000 77.385193,174.068802 56.331352,173.296707 C38.414093,172.639633 23.339199,157.553452 21.547924,138.766296 C21.113335,134.208252 21.527847,129.847885 22.717625,125.076393z"
      />
      <path
        fill="currentColor"
        d="M44.139038,90.551071 C35.364052,67.163994 48.728558,44.618488 69.361465,39.255489 C82.805954,35.760937 94.595177,39.062199 105.173309,47.746353 C107.557846,49.703949 108.192871,51.716087 107.207916,54.695705 C101.213554,72.829414 95.256615,90.976944 89.514313,109.191460 C88.146080,113.531479 85.016335,114.083000 81.432297,114.216988 C68.452835,114.702232 51.554111,109.131767 44.139038,90.551071z"
      />
      <path
        fill="currentColor"
        d="M111.621613,210.767517 C91.210434,210.746414 76.498177,199.089447 72.252869,180.286392 C71.564423,177.237183 72.034439,175.286530 74.584305,173.454239 C90.262726,162.188034 105.914528,150.883392 121.465668,139.442673 C124.224525,137.413025 126.335213,138.359192 128.751801,139.686234 C142.516678,147.245117 150.297806,164.547760 146.942429,180.215622 C143.350739,196.986908 130.349960,208.888397 114.009102,210.373215 C113.348824,210.433212 112.695030,210.564636 111.621613,210.767517z"
      />
      <path
        fill="currentColor"
        d="M198.292404,141.973450 C193.736832,163.887329 177.946381,175.831268 156.226440,174.343094 C153.340530,174.145355 151.678650,173.081940 150.774933,170.276901 C144.914291,152.085968 139.013397,133.907379 132.980591,115.773033 C131.791718,112.199333 132.743164,109.795967 135.551804,107.570755 C147.805527,97.862404 161.204407,95.163124 175.691437,101.578323 C190.067963,107.944580 197.741501,119.214180 198.358597,135.061783 C198.442657,137.220551 198.331467,139.386948 198.292404,141.973450z"
      />
      <path
        fill="currentColor"
        d="M177.948151,64.410423 C181.251205,74.203201 180.580627,83.414330 176.757797,92.513206 C175.673096,95.094940 174.178986,96.434517 171.163391,96.417152 C151.531937,96.304115 131.899414,96.285431 112.267853,96.374512 C109.046204,96.389130 107.979568,94.440659 106.970718,92.056717 C98.386276,71.771317 107.335533,49.571316 127.351814,41.520931 C147.857620,33.273659 170.085144,43.190804 177.948151,64.410423z"
      />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente principal: LoginPage (flujo de 2 pasos)
   ═══════════════════════════════════════════════════════════════════════════ */

function LoginPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState<LoginStep>('credentials')
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null)

  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Si ya está autenticado y pasó por el flujo, redirigir
  if (user && step === 'credentials') {
    navigate({ to: '/' })
    return null
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Handlers
     ───────────────────────────────────────────────────────────────────────── */

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const username = (usernameRef.current?.value ?? '').normalize('NFC').trim()
    const password = (passwordRef.current?.value ?? '').normalize('NFC')

    try {
      const fbUser = await loginWithEmail(username, password)
      const name = fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario'
      setDisplayName(name.toUpperCase())
      setDirection(1)
      setStep('schedule')
    } catch (err) {
      console.error('[Login] Error de autenticación:', err)
      setError(GENERIC_AUTH_ERROR)
      usernameRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleBack() {
    await logout()
    setDirection(-1)
    setStep('credentials')
    setSelectedTurno(null)
    setError(null)
  }

  function handleConfirmTurno() {
    if (!selectedTurno) return
    setLoading(true)
    sessionStorage.setItem('cidyt_turno', selectedTurno)
    navigate({ to: '/' })
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────────────────── */

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #0A1F5C 0%, #0d2870 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div
        className="w-full mx-4 overflow-hidden"
        style={{
          maxWidth: 480,
          backgroundColor: 'var(--color-fondo-card)',
          borderRadius: 'var(--radius-default)',
          boxShadow: 'var(--shadow-hover)',
        }}
      >
        {/* ═══ Header de la Card ═══ */}
        <div
          className="flex flex-col items-center"
          style={{
            backgroundColor: 'var(--color-primario)',
            padding: '40px 24px 28px',
          }}
        >
          <CorporateLogo className="w-14 h-14 text-white" />
          <h1 className="text-[22px] font-bold text-white" style={{ marginTop: 12 }}>
            IPadCIDyT
          </h1>
          <p className="text-white/60 text-[13px]" style={{ marginTop: 4 }}>
            {step === 'credentials' ? 'Inicia sesión para continuar' : 'Selecciona tu horario'}
          </p>
        </div>

        {/* ═══ Cuerpo de la Card ═══ */}
        <div style={{ padding: '32px 28px 36px', overflow: 'hidden', position: 'relative', minHeight: 280 }}>
          <AnimatePresence mode="wait" custom={direction}>
            {step === 'credentials' ? (
              <motion.div
                key="credentials"
                custom={direction}
                variants={pageSlide}
                initial="enter"
                animate="center"
                exit="exit"
              >
              {error && (
                <AlertBanner variant="error" className="mb-5">
                  {error}
                </AlertBanner>
              )}

              <form onSubmit={handleCredentialsSubmit} noValidate>
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="login-username"
                    className="block text-[13px] font-medium"
                    style={{ color: 'var(--color-texto-suave)', marginBottom: 6 }}
                  >
                    Usuario
                  </label>
                  <input
                    ref={usernameRef}
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={loading}
                    placeholder="Nombre de usuario"
                    style={{ touchAction: 'manipulation' }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    htmlFor="login-password"
                    className="block text-[13px] font-medium"
                    style={{ color: 'var(--color-texto-suave)', marginBottom: 6 }}
                  >
                    Contraseña
                  </label>
                  <input
                    ref={passwordRef}
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    style={{ touchAction: 'manipulation' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2"
                  style={{
                    height: 48,
                    backgroundColor: 'var(--color-primario)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    borderRadius: 'var(--radius-default)',
                    touchAction: 'manipulation',
                  }}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white/35 border-t-white" />
                      Iniciando sesión...
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </button>
              </form>
              </motion.div>
            ) : (
              <motion.div
                key="schedule"
                custom={direction}
                variants={pageSlide}
                initial="enter"
                animate="center"
                exit="exit"
              >
            <div>
              <p className="text-[14px]" style={{ color: 'var(--color-texto-suave)' }}>
                Bienvenido,{' '}
                <span className="font-bold" style={{ color: 'var(--color-texto)' }}>
                  {displayName}
                </span>
              </p>
              <p
                className="text-[13px] italic"
                style={{ color: 'var(--color-texto-suave)', marginTop: 4 }}
              >
                Selecciona tu horario de trabajo
              </p>

              {/* Tarjetas de turno */}
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <TurnoCard
                  turno="MATUTINO"
                  emoji="☀️"
                  selected={selectedTurno === 'MATUTINO'}
                  onSelect={() => setSelectedTurno('MATUTINO')}
                />
                <TurnoCard
                  turno="VESPERTINO"
                  emoji="🌙"
                  selected={selectedTurno === 'VESPERTINO'}
                  onSelect={() => setSelectedTurno('VESPERTINO')}
                />
              </div>

              {/* Botonera inferior */}
              <div
                className="flex items-center"
                style={{ marginTop: 24, gap: 12 }}
              >
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="inline-flex items-center justify-center"
                  style={{
                    height: 48,
                    padding: '0 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-texto-suave)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-borde)',
                    borderRadius: 'var(--radius-default)',
                    touchAction: 'manipulation',
                  }}
                >
                  ← Regresar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmTurno}
                  disabled={!selectedTurno || loading}
                  className="flex-1 inline-flex items-center justify-center gap-2"
                  style={{
                    height: 48,
                    backgroundColor: 'var(--color-primario)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    borderRadius: 'var(--radius-default)',
                    touchAction: 'manipulation',
                  }}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white/35 border-t-white" />
                      Ingresando...
                    </>
                  ) : (
                    'Entrar al sistema'
                  )}
                </button>
              </div>
            </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-componente: TurnoCard (Radio visual accesible)
   ═══════════════════════════════════════════════════════════════════════════ */


function TurnoCard({
  turno,
  emoji,
  selected,
  onSelect,
}: {
  turno: Turno
  emoji: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Turno ${turno.toLowerCase()}`}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 text-left"
      style={{
        minHeight: 48,
        padding: '12px 16px',
        borderRadius: 'var(--radius-default)',
        border: selected
          ? '2px solid var(--color-acento)'
          : '1px solid var(--color-borde)',
        backgroundColor: selected ? 'rgba(0,166,81,0.04)' : 'var(--color-fondo-card)',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-texto)',
        touchAction: 'manipulation',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Indicador geométrico accesible */}
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: selected ? '2px solid var(--color-acento)' : '2px solid var(--color-borde)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}
        aria-hidden="true"
      >
        {selected && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: 'var(--color-acento)',
            }}
          />
        )}
      </span>

      <span aria-hidden="true">{emoji}</span>
      <span>{turno}</span>
    </motion.button>
  )
}
