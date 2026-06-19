import { Link, useLocation } from '@tanstack/react-router'
import type { NavMenuItem } from '@/types/menu'

/* ═══════════════════════════════════════════════════════════════════════════
   Logo corporativo Médica Sur — versión blanca (SVG inline)
   ═══════════════════════════════════════════════════════════════════════════ */

function LogoMedicaSur({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 224 224"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path fill="white" d="M22.717625,125.076393 C25.601562,114.946541 31.305059,107.479958 40.054077,102.317253 C42.740337,100.732124 45.096073,100.366379 47.845802,102.382645 C63.553398,113.900444 79.337143,125.314537 95.117111,136.733322 C96.984077,138.084320 97.408218,139.726044 97.041550,141.941315 C93.824883,161.375000 77.385193,174.068802 56.331352,173.296707 C38.414093,172.639633 23.339199,157.553452 21.547924,138.766296 C21.113335,134.208252 21.527847,129.847885 22.717625,125.076393z" />
      <path fill="white" d="M44.139038,90.551071 C35.364052,67.163994 48.728558,44.618488 69.361465,39.255489 C82.805954,35.760937 94.595177,39.062199 105.173309,47.746353 C107.557846,49.703949 108.192871,51.716087 107.207916,54.695705 C101.213554,72.829414 95.256615,90.976944 89.514313,109.191460 C88.146080,113.531479 85.016335,114.083000 81.432297,114.216988 C68.452835,114.702232 51.554111,109.131767 44.139038,90.551071z" />
      <path fill="white" d="M111.621613,210.767517 C91.210434,210.746414 76.498177,199.089447 72.252869,180.286392 C71.564423,177.237183 72.034439,175.286530 74.584305,173.454239 C90.262726,162.188034 105.914528,150.883392 121.465668,139.442673 C124.224525,137.413025 126.335213,138.359192 128.751801,139.686234 C142.516678,147.245117 150.297806,164.547760 146.942429,180.215622 C143.350739,196.986908 130.349960,208.888397 114.009102,210.373215 C113.348824,210.433212 112.695030,210.564636 111.621613,210.767517z" />
      <path fill="white" d="M198.292404,141.973450 C193.736832,163.887329 177.946381,175.831268 156.226440,174.343094 C153.340530,174.145355 151.678650,173.081940 150.774933,170.276901 C144.914291,152.085968 139.013397,133.907379 132.980591,115.773033 C131.791718,112.199333 132.743164,109.795967 135.551804,107.570755 C147.805527,97.862404 161.204407,95.163124 175.691437,101.578323 C190.067963,107.944580 197.741501,119.214180 198.358597,135.061783 C198.442657,137.220551 198.331467,139.386948 198.292404,141.973450z" />
      <path fill="white" d="M177.948151,64.410423 C181.251205,74.203201 180.580627,83.414330 176.757797,92.513206 C175.673096,95.094940 174.178986,96.434517 171.163391,96.417152 C151.531937,96.304115 131.899414,96.285431 112.267853,96.374512 C109.046204,96.389130 107.979568,94.440659 106.970718,92.056717 C98.386276,71.771317 107.335533,49.571316 127.351814,41.520931 C147.857620,33.273659 170.085144,43.190804 177.948151,64.410423z" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   TurnoPill — badge de turno con estilo legacy
   ═══════════════════════════════════════════════════════════════════════════ */

function TurnoPill({ turno }: { turno: string }) {
  const esVespertino = turno.toLowerCase().includes('vespert')
  const icono = esVespertino ? '🌙' : '☀️'

  return (
    <span
      className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide"
      style={{
        padding: '2px 8px',
        borderRadius: 50,
        backgroundColor: esVespertino
          ? 'rgba(123,31,162,0.30)'
          : 'rgba(25,118,210,0.30)',
        color: esVespertino ? '#e1bee7' : '#bbdefb',
        border: `1px solid ${esVespertino ? 'rgba(123,31,162,0.45)' : 'rgba(25,118,210,0.45)'}`,
      }}
      aria-label={`Turno ${turno}`}
    >
      <span aria-hidden="true">{icono}</span>
      {turno}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SidebarNav — Navegación completa tipo legacy
   ═══════════════════════════════════════════════════════════════════════════ */

interface SidebarNavProps {
  items: NavMenuItem[]
  userName: string
  turno: string | null
  onNavigate?: () => void
}

export function SidebarNav({ items, userName, turno, onNavigate }: SidebarNavProps) {
  const location = useLocation()
  const inicial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full">
      {/* ── Bloque 1: Encabezado Corporativo ── */}
      <div style={{ padding: '12px 12px 10px', flexShrink: 0 }}>
        {/* Marca + logo */}
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-[1rem] leading-none tracking-tight">
            IPadCIDyT
          </span>
          <LogoMedicaSur size={32} />
        </div>
        <span className="block text-white/45 text-[0.6875rem] mt-0.5 ml-px">
          v{__APP_VERSION__}
        </span>

        {/* ── Bloque 2: Usuario ── */}
        <div className="flex items-center gap-2.5 mt-2.5">
          {/* Avatar */}
          <div
            className="flex items-center justify-center shrink-0 text-white font-bold text-[0.875rem]"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'var(--color-acento)',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.15)',
            }}
            aria-hidden="true"
          >
            {inicial}
          </div>

          {/* Nombre + turno */}
          <div className="flex flex-col gap-1 overflow-hidden">
            <span
              className="text-white font-semibold text-[0.8125rem] leading-tight truncate"
              title={userName}
            >
              {userName}
            </span>
            {turno && <TurnoPill turno={turno} />}
          </div>
        </div>
      </div>

      {/* ── Separador ── */}
      <div
        className="shrink-0"
        style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 16px' }}
        aria-hidden="true"
      />

      {/* ── Bloque 3: Navegación Principal (scrollable) ── */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-touch"
        style={{ padding: '6px 0' }}
        aria-label="Navegación principal"
      >
        {items.map((item) => {
          const isActive =
            location.pathname === item.route ||
            (item.route !== '/' && location.pathname.startsWith(`${item.route}/`))

          return (
            <Link
              key={item.id}
              to={item.route}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className="nav-link flex items-center no-underline interactive"
              style={{
                minHeight: 44,
                padding: '6px 12px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderLeft: isActive
                  ? '3px solid var(--color-acento)'
                  : '3px solid transparent',
                backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                transition: 'background-color 0.2s ease, border-left-color 0.2s ease, transform var(--motion-duration-fast) var(--motion-spring)',
              }}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}

        {items.length === 0 && (
          <p className="text-white/40 text-[0.8125rem] px-4 py-3 m-0">
            Sin ítems de menú
          </p>
        )}
      </nav>

      {/* ── Bloque 4: Botón Salir (footer) ── */}
      {/* Se maneja desde AppShell para tener acceso a logout + navigate */}
    </div>
  )
}
