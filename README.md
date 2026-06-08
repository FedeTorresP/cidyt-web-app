# 🏥 cidyt-web-app — Plataforma Core de Diagnóstico y Consulta Médica

**IPadCIDyT v4 — Vite + TanStack + Firebase**

---

## Descripción

cidyt-web-app es la modernización completa de la plataforma clínica IPadCIDyT, migrando de Next.js 14 (SSR) a una SPA client-side con Vite. Diseñada para uso exclusivo en iPad por personal médico del CIDyT (Centro Integral de Diagnóstico y Tratamiento) de Médica Sur.

La interfaz mantiene paridad visual 100% con el ecosistema legacy, optimizada para pantallas táctiles iPadOS con densidad de datos clínica.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Build / Dev | Vite 6 |
| Router | TanStack Router (file-based) |
| Data Fetching | TanStack Query |
| Tablas | TanStack Table |
| Formularios | TanStack Form |
| UI | shadcn/ui (Radix + Tailwind CSS v4) |
| Auth + DB | Firebase Client SDK (Auth + Firestore) |
| Tipos | TypeScript 5.8 |
| Iconos | Lucide React |

---

## Inicio Rápido

### Prerrequisitos

- Node.js ≥ 20
- Acceso al proyecto Firebase `ipad-cidyt`

### Instalación

```bash
git clone https://github.com/Medica-Sur-TI/cidyt-web-app.git
cd cidyt-web-app
npm install
```

### Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con las llaves del proyecto Firebase:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_TIMEZONE=America/Mexico_City
```

### Desarrollo

```bash
npm run dev
```

Disponible en `http://localhost:5173`

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (HMR) |
| `npm run build` | Build de producción (typecheck + bundle) |
| `npm run preview` | Preview del build de producción |
| `npm run typecheck` | Verificación de tipos sin emitir |
| `npm run lint` | ESLint |

---

## Estructura del Proyecto

```
src/
├── main.tsx                    Entry point
├── App.tsx                     Router provider
├── globals.css                 Tailwind + design tokens Médica Sur
├── lib/
│   ├── firebase.ts             Firebase Client SDK init
│   ├── query-client.ts         TanStack Query client
│   └── utils.ts                cn() helper (clsx + tailwind-merge)
├── services/
│   ├── auth.ts                 Login, logout, onAuthStateChanged
│   ├── rbac.ts                 Permisos y filtrado de menú
│   ├── audit.ts                Auditoría transaccional
│   └── time.ts                 UTC ↔ America/Mexico_City
├── hooks/
│   ├── use-auth.tsx            AuthContext + useAuth
│   ├── use-menu.ts             Menú dinámico (Firestore + fallback)
│   ├── use-cubiculos.ts        Queries de cubículos
│   ├── use-facturas.ts         Queries/mutations de caja
│   ├── use-medicos.ts          Médicos activos
│   └── use-reportes.ts         Reportes (checkup, general, estadística)
├── components/
│   ├── ui/                     Primitivos shadcn (Button, Input, Card)
│   ├── layout/                 AppShell, SidebarNav
│   └── shared/                 DataTable, AlertBanner, LoadingSpinner
├── routes/
│   ├── __root.tsx              Root layout
│   ├── login.tsx               Login (pública)
│   ├── _authenticated.tsx      Guard de auth + AppShell
│   └── _authenticated/         Rutas protegidas (caja, lista-dia, etc.)
└── types/
    ├── models.ts               Interfaces Firestore
    ├── auth.ts                 AuthUser, AuthState
    └── menu.ts                 NavMenuItem
```

---

## Autenticación

- Firebase Auth con email/password
- `onAuthStateChanged` para estado reactivo
- Custom Claims para RBAC (`roleId`, `permissions`)
- Si no hay claims configurados, el sistema asume acceso admin (modo desarrollo)
- Route guard via `beforeLoad` en TanStack Router

---

## Menú Lateral

El menú se carga desde la colección `menu_items` de Firestore, filtrado por permisos del rol. Si la colección está vacía o inaccesible, se usa un fallback estático con todas las rutas.

---

## Colecciones Firestore

| Colección | Uso |
|-----------|-----|
| `pacientes` | Datos demográficos |
| `seguimientos` | Check-ups activos |
| `estudios_paciente` | Estudios asignados |
| `facturas` | Movimientos de caja |
| `cubiculos` | Cubículos físicos |
| `sesiones_cubiculo` | Asignación médico-cubículo |
| `medicos` | Catálogo de médicos |
| `empresas` | Empresas clientes |
| `menu_items` | Menú lateral dinámico |
| `roles` / `rol_permisos` / `permisos` | RBAC |
| `audit_log` | Auditoría |

---

## Design System

Basado en la identidad visual de Médica Sur, traducido del legacy a Tailwind CSS v4:

- **Primario:** `#0A1F5C` (azul institucional)
- **Acento:** `#00A651` (verde Médica Sur)
- **Optimizado para iPad:** targets táctiles 44×44px, densidad compacta, touch-action manipulation
- **Tipografía:** SF Pro / system-ui a 13px base

---

## Seguridad

- Sin servidor — la seguridad de datos depende de Firestore Security Rules
- No se usa Firebase Admin SDK
- Credenciales nunca se almacenan en el repositorio
- `.env.local` excluido via `.gitignore`

---

## Licencia

Uso interno — Propiedad de Médica Sur. Todos los derechos reservados.
