# 🏥 cidyt-web-app

**IPadCIDyT v3.0** — Plataforma Core de Diagnóstico y Consulta Médica

Vite + TanStack + shadcn/ui + Firebase Client SDK

---

## Descripción

Sistema clínico integral del CIDyT (Centro Integral de Diagnóstico y Tratamiento) de Médica Sur. Diseñado para uso exclusivo en iPad por personal médico, con interfaz táctil optimizada para iPadOS.

Gestiona el flujo completo del paciente: admisión, asignación de cubículos, seguimiento de estudios, facturación en caja y reportes operativos.

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Build / Dev | Vite | 6.3 |
| Router | TanStack Router (file-based) | 1.x |
| Data Fetching | TanStack Query | 5.x |
| Tablas | TanStack Table | 8.x |
| Formularios | TanStack Form | 1.x |
| UI | shadcn/ui (Radix + Tailwind CSS v4) | — |
| Auth + DB | Firebase Client SDK (Auth + Firestore) | 11.10 |
| Tipos | TypeScript | 5.8 |
| Iconos | Lucide React | — |
| PWA | vite-plugin-pwa (Workbox) | 1.3 |

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

Edita `.env.local` con las llaves del proyecto Firebase (solicitar a TI):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_TIMEZONE=America/Mexico_City
```

### Desarrollo local

```bash
npm run dev
```

Disponible en `http://localhost:5173`

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción (typecheck + bundle) |
| `npm run preview` | Preview local del build |
| `npm run typecheck` | Verificación de tipos |
| `npm run lint` | ESLint |

### Scripts de administración

| Comando | Descripción |
|---------|-------------|
| `node scripts/create-admin.mjs` | Crea el super usuario admin en Firebase Auth |
| `node scripts/seed-catalogos.mjs` | Sube catálogos a Firestore (requiere gcloud auth) |
| `node scripts/seed-catalogos.mjs --dry-run` | Simula el seed sin escribir en Firestore |
| `node scripts/seed-catalogos.mjs --collection=X` | Sube solo la colección indicada |

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
│   └── utils.ts                cn() helper
├── services/
│   ├── auth.ts                 Login, logout, onAuthStateChanged
│   ├── rbac.ts                 Permisos y filtrado de menú
│   ├── audit.ts                Auditoría transaccional
│   └── time.ts                 UTC ↔ America/Mexico_City
├── hooks/
│   ├── use-auth.tsx            AuthContext + useAuth
│   ├── use-menu.ts             Menú dinámico (Firestore + RBAC)
│   ├── use-cubiculos.ts        Queries de cubículos
│   ├── use-facturas.ts         Queries/mutations de caja
│   ├── use-medicos.ts          Médicos activos
│   └── use-reportes.ts         Reportes
├── components/
│   ├── ui/                     Primitivos shadcn (Button, Input, Card)
│   ├── layout/                 AppShell, SidebarNav
│   └── shared/                 DataTable, AlertBanner, LoadingSpinner
├── routes/
│   ├── __root.tsx              Root layout
│   ├── login.tsx               Login (pública)
│   ├── _authenticated.tsx      Guard de auth + AppShell
│   └── _authenticated/         Rutas protegidas
└── types/
    ├── models.ts               Interfaces Firestore
    ├── auth.ts                 AuthUser, AuthState
    └── menu.ts                 NavMenuItem
```

---

## Autenticación y RBAC

- Firebase Auth con email/password
- Estado reactivo via `onAuthStateChanged`
- Custom Claims para RBAC (`roleId`, permisos)
- Route guard con `beforeLoad` en TanStack Router
- Menú lateral dinámico filtrado por permisos del rol

---

## Deploy

El deploy es automático al hacer push a `main`:

1. GitHub Actions ejecuta el workflow `.github/workflows/deploy.yml`
2. Se obtienen las variables de entorno desde GCP Secret Manager
3. Build con Docker (multi-stage)
4. Deploy a Firebase Hosting (SPA estática)

**URL de producción:** https://ipad-cidyt.web.app

---

## Infraestructura

- **Hosting:** Firebase Hosting (SPA estática, sin servidor)
- **Auth:** Firebase Authentication
- **Base de datos:** Cloud Firestore
- **CI/CD:** GitHub Actions + Docker
- **Secretos:** GCP Secret Manager
- **IaC:** Terraform (directorio `terraform/`)
- **Logging:** Cloud Logging (pipeline de deploy)

---

## PWA (Progressive Web App)

La aplicación es instalable en iPads como PWA:

- **Offline-first**: assets estáticos precacheados por Workbox, datos de Firestore con estrategia `NetworkFirst` (fallback a cache si no hay red)
- **Instalable**: manifest con `display: standalone`, iconos y tema configurados
- **Auto-update**: service worker se actualiza automáticamente cuando hay nueva versión desplegada
- **Auth siempre online**: las peticiones a Firebase Auth usan `NetworkOnly` (nunca se cachean tokens)

Para instalar en iPad: Safari → Compartir → "Agregar a la pantalla de inicio"

---

## Seguridad

- Sin servidor — la seguridad de datos depende de Firestore Security Rules
- No se usa Firebase Admin SDK en la app
- Credenciales almacenadas en GCP Secret Manager
- `.env.local` excluido via `.gitignore`

---

## Convención de Commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/). Formato:

```
tipo(scope): descripción corta
```

| Tipo | Cuándo usar | Ejemplo |
|------|-------------|---------|
| `feat` | Nueva funcionalidad o componente | `feat: add cubiculos grid view` |
| `fix` | Corrección de bug | `fix: resolve auth/invalid-api-key on deploy` |
| `docs` | Cambios en documentación | `docs: update README with deploy instructions` |
| `style` | Cambios de formato/estilos (sin lógica) | `style: adjust card padding for iPad grid` |
| `refactor` | Reestructura de código sin cambiar comportamiento | `refactor: extract DataTable into shared component` |
| `ci` | Cambios en CI/CD o pipelines | `ci: add Firebase Hosting deploy pipeline` |
| `chore` | Tareas de mantenimiento, deps, configs | `chore: bump firebase to 11.10` |
| `perf` | Mejora de rendimiento | `perf: lazy load reportes route` |

**Scope** (opcional): módulo afectado entre paréntesis.

```
fix(auth): handle expired token on page reload
feat(caja): add factura search by folio
ci(docker): add route tree generation step
```

**Reglas:**
- Primera línea ≤ 72 caracteres
- Verbo en imperativo inglés: "add", "fix", "update" (no "added", "fixing")
- Sin punto final
- Si el cambio es breaking, agregar `!` después del tipo: `feat!: migrate auth to client SDK`

---

## Licencia

Uso interno — Propiedad de Médica Sur. Todos los derechos reservados.
