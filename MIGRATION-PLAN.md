# Plan de Migración — cidyt-web-app

## De Next.js 14 + Firebase Admin SDK → Vite + TanStack + shadcn/ui + Firebase Client SDK

---

## 1. Stack Tecnológico Objetivo

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Build / Dev Server | **Vite** (React plugin) | 6.x |
| Routing | **TanStack Router** (file-based) | 1.x |
| Data Fetching / Cache | **TanStack Query** | 5.x |
| Tablas | **TanStack Table** | 8.x |
| Formularios | **TanStack Form** | 1.x |
| Estado local reactivo | **TanStack DB** | (latest) |
| UI Components | **shadcn/ui** (Radix + Tailwind) | — |
| Estilos | **Tailwind CSS v4** | 4.x |
| Auth + DB | **Firebase Client SDK** | 11.x |
| Tipos | **TypeScript** | 5.9+ |
| Linter | **ESLint** + Prettier | — |

---

## 2. Cambios Arquitectónicos Clave

### 2.1 Autenticación

| Antes (Next.js) | Después (Vite SPA) |
|-----------------|---------------------|
| Cookie HTTP-only `__session` con ID Token | `onAuthStateChanged` + React Context |
| Verificación con Admin SDK (`verifyIdToken`) | Token decodificado en cliente (`getIdTokenResult`) |
| Middleware server-side deny-by-default | Route guards con `beforeLoad` en TanStack Router |
| Custom Claims extraídos server-side | Custom Claims extraídos de `idTokenResult.claims` |

### 2.2 Data Layer

| Antes | Después |
|-------|---------|
| Server Components llaman Firestore Admin SDK | TanStack Query hooks llaman Firebase Client SDK |
| `getFirestoreDb()` → Admin `Firestore` | `getFirestore(app)` → Client `Firestore` |
| Lookups paralelos con `Promise.all` (server) | Mismos lookups en hooks con `useQuery` / `useSuspenseQuery` |
| `revalidatePath()` para cache | `queryClient.invalidateQueries()` |
| Server Actions para mutations | `useMutation` + transacciones Firestore client |

### 2.3 RBAC y Menú Dinámico

| Antes | Después |
|-------|---------|
| `buildMenu(roleId)` en Server Component | `useMenu()` hook con TanStack Query |
| Filtrado por permisos server-side | Filtrado en cliente con claims del token |
| `NavigationError` renderizado en layout SSR | Error boundary + estado de loading/error reactivo |

### 2.4 UI / UX

| Antes (Ecosistema Legacy) | Después (Vite SPA) |
|---------------------------|---------------------|
| Estilos inline (`React.CSSProperties`) | **shadcn/ui** + Tailwind CSS |
| CSS Modules extendidos en toda la app (Estructuras, Caja, Paneles iPad) | Tailwind utilities integradas en componentes (Traducción e Ingeniería Inversa) |
| Sin design system formal | shadcn/ui como sistema de componentes unificado |
| Design tokens dispersos en múltiples archivos `.module.css` y `globals.css` | Centralización total en variables CSS + configuración nativa de Tailwind |

> 🎨 **Consideración Estratégica de UI/UX (Paridad Visual iPadOS):**
>
> La interfaz de usuario se **clonará directamente** del comportamiento visual del Legacy para garantizar una transición transparente y ergonómica para el personal médico. El proceso **no** consistirá en copiar archivos de estilos antiguos, sino en realizar una **traducción de diseño**:
>
> 1. **Extracción de Tokens:** Se leerán los archivos CSS Modules para extraer los valores puros de la paleta institucional de Médica Sur, paddings, gaps y sombras, mapeándolos directamente en la configuración extendida de Tailwind.
>
> 2. **Ingeniería Inversa Estructural** (ej. `caja.module.css`): Se analizarán los selectores complejos del legacy para recrear con exactitud el patrón de tablas y rejillas ultra-compactas optimizadas para pantallas de iPad, implementándolas de forma limpia mediante utilidades de Tailwind dentro de los componentes de shadcn/ui y TanStack Table.

### 2.5 Seguridad

- **Firestore Security Rules** deben estar configuradas para proteger colecciones (ya no hay Admin SDK que bypasee reglas).
- El client SDK respeta las Security Rules — el RBAC a nivel de datos depende de ellas.
- Auditoría (`audit_log`) se escribe vía transacción client-side (o se mueve a Cloud Function trigger si se requiere integridad absoluta).

---

## 3. Estructura de Archivos

```
cidyt-web-app/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── package.json
├── components.json                    ← shadcn/ui config
├── .env.example
├── .env.local                         ← Llaves Firebase (VITE_FIREBASE_*)
│
├── src/
│   ├── main.tsx                       ← Entry point (React + providers)
│   ├── App.tsx                        ← Router provider
│   ├── globals.css                    ← Tailwind base + design tokens Médica Sur
│   │
│   ├── lib/
│   │   ├── firebase.ts               ← initializeApp + getAuth + getFirestore
│   │   ├── query-client.ts           ← TanStack Query client singleton
│   │   └── utils.ts                  ← cn() helper (shadcn)
│   │
│   ├── services/
│   │   ├── auth.ts                   ← signIn, signOut, onAuthStateChanged wrapper
│   │   ├── rbac.ts                   ← getPermissions, filterMenuByRole
│   │   ├── audit.ts                  ← addAuditWithinTransaction (client SDK)
│   │   └── time.ts                   ← UTC ↔ America/Mexico_City helpers
│   │
│   ├── hooks/
│   │   ├── use-auth.ts              ← AuthContext + useAuth hook
│   │   ├── use-menu.ts             ← useQuery → menu_items + filtrado RBAC
│   │   ├── use-cubiculos.ts
│   │   ├── use-sesiones-cubiculo.ts
│   │   ├── use-facturas.ts
│   │   ├── use-seguimientos.ts
│   │   ├── use-pacientes.ts
│   │   ├── use-medicos.ts
│   │   ├── use-reportes.ts
│   │   ├── use-estudios.ts
│   │   └── use-usuarios.ts
│   │
│   ├── components/
│   │   ├── ui/                       ← shadcn/ui primitives (button, input, card, table, dialog, sheet, etc.)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          ← Sidebar + main content area
│   │   │   ├── SidebarNav.tsx        ← Menú dinámico desde Firestore
│   │   │   └── HamburgerButton.tsx
│   │   └── shared/
│   │       ├── DataTable.tsx         ← Wrapper genérico TanStack Table + shadcn
│   │       ├── DateRangePicker.tsx
│   │       ├── EstatusCell.tsx       ← Celda de color para estatus clínicos
│   │       ├── LoadingSpinner.tsx
│   │       └── AlertBanner.tsx
│   │
│   ├── routes/
│   │   ├── __root.tsx               ← Root layout (providers, error boundary)
│   │   ├── login.tsx                ← Ruta pública: formulario de login
│   │   ├── _authenticated.tsx       ← Layout guard: requiere auth + carga menú
│   │   ├── _authenticated/
│   │   │   ├── index.tsx            ← Home / dashboard
│   │   │   ├── caja.tsx             ← Lista de pacientes caja (tabla compacta)
│   │   │   ├── caja.$id.tsx         ← Detalle factura/seguimiento
│   │   │   ├── cubiculo.tsx         ← Grid de cubículos
│   │   │   ├── cubiculo.listado.tsx ← Listado + crear sesión
│   │   │   ├── lista-dia.tsx        ← Lista del día con cambio de estatus
│   │   │   ├── medico-dia.tsx       ← Asignación médico-día
│   │   │   ├── reportes.tsx         ← Reportes con filtro de fecha
│   │   │   ├── catalogos.tsx        ← Índice de catálogos
│   │   │   ├── catalogos.$tipo.tsx  ← CRUD genérico por catálogo
│   │   │   ├── paciente.$id.tsx     ← Detalle de paciente
│   │   │   ├── cambio-clave.tsx     ← Cambiar contraseña
│   │   │   ├── importacion.tsx      ← Importación masiva
│   │   │   ├── externos.tsx         ← Pacientes externos
│   │   │   ├── paquetes.tsx         ← Paquetes de estudios
│   │   │   ├── admin.perfiles.tsx   ← Gestión de perfiles/roles
│   │   │   └── admin.usuarios.tsx   ← Gestión de usuarios
│   │
│   └── types/
│       ├── models.ts                ← Interfaces Firestore (Paciente, Seguimiento, Factura, etc.)
│       ├── auth.ts                  ← AuthUser, Claims, etc.
│       └── menu.ts                  ← MenuItem, NavigationState
│
└── public/
    ├── favicon.ico
    ├── apple-touch-icon.png
    └── LogoMS1.svg
```

---

## 4. Mapeo de Colecciones Firestore (sin cambios en DB)

Las colecciones se consumen **tal cual** desde el Client SDK:

| Colección | Uso principal |
|-----------|---------------|
| `pacientes` | Datos demográficos de pacientes |
| `seguimientos` | Seguimientos activos (check-ups) |
| `estudios_paciente` | Estudios asignados a un seguimiento |
| `estudios` | Catálogo de estudios clínicos |
| `estudio_tipos` | Tipos de estudio |
| `estatus_estudio` | Catálogo de estatus de estudio |
| `facturas` | Movimientos de caja |
| `empresas` | Catálogo de empresas |
| `medicos` | Catálogo de médicos |
| `cubiculos` | Cubículos físicos |
| `sesiones_cubiculo` | Asignación médico-cubículo |
| `estatus_cubiculo_medico` | Estatus de sesión |
| `entidades` | Entidades organizativas |
| `menu_items` | Elementos del menú lateral |
| `roles` | Definición de roles |
| `rol_permisos` | Permisos por rol |
| `permisos` | Catálogo de permisos |
| `audit_log` | Registro de auditoría |
| `horarios` | Horarios laborales |
| `paquetes` | Paquetes de estudios |
| `lugares` | Catálogo de lugares |
| `promotores` | Catálogo de promotores |

---

## 5. Design Tokens → Tailwind Config

Los tokens del `globals.css` del Legacy se mapean así:

```ts
// tailwind.config.ts (extracto)
export default {
  theme: {
    extend: {
      colors: {
        primario:       { DEFAULT: '#0A1F5C', hover: '#0d2870' },
        acento:         { DEFAULT: '#00A651', hover: '#008f45' },
        fondo:          '#F7F9FC',
        'fondo-card':   '#FFFFFF',
        texto:          '#1A1A2E',
        'texto-suave':  '#5A6478',
        borde:          '#E4E9F0',
        error:          '#D32F2F',
        warning:        '#F57C00',
        success:        '#00A651',
        info:           '#1976D2',
      },
      borderRadius: {
        DEFAULT: '10px',
        pill:    '50px',
      },
      boxShadow: {
        card:  '0 2px 12px rgba(10, 31, 92, 0.08)',
        hover: '0 6px 24px rgba(10, 31, 92, 0.14)',
      },
    },
  },
}
```

---

## 6. Variables de Entorno

Archivo `.env.local` (basado en las llaves existentes de IPadCIDyT):

```env
VITE_FIREBASE_API_KEY=AIzaSyAOsvAbSHzCTMy0ToY2Gy23DXOkFkuwK8c
VITE_FIREBASE_AUTH_DOMAIN=ipad-cidyt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ipad-cidyt
VITE_FIREBASE_STORAGE_BUCKET=ipad-cidyt.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=734571015446
VITE_FIREBASE_APP_ID=1:734571015446:web:6948890b9b2487fd417437
VITE_APP_TIMEZONE=America/Mexico_City
```

> **No se requiere Admin SDK.** Todo opera con Firebase Client SDK. La seguridad de datos se garantiza con Firestore Security Rules.

---

## 7. Fases de Implementación

### Fase 1 — Scaffold base
- `package.json` con todas las dependencias
- Vite config + TypeScript config
- Tailwind CSS v4 con design tokens integrados
- shadcn/ui inicializado (components.json + primitivos base)
- Firebase Client SDK inicializado

### Fase 2 — Autenticación + Router
- TanStack Router con file-based routing
- AuthContext + `useAuth` hook (`onAuthStateChanged`)
- Route guard `_authenticated.tsx` con `beforeLoad`
- Página de login funcional

### Fase 3 — Layout + Menú dinámico
- `AppShell` con sidebar responsive (patrón iPadOS del Legacy)
- `SidebarNav` con `useMenu()` (query a `menu_items` + filtrado RBAC)
- Hamburger para portrait mode

### Fase 4 — Data Layer (hooks)
- TanStack Query hooks para cada dominio
- Mutations con transacciones + auditoría
- `DataTable` genérico con TanStack Table

### Fase 5 — Páginas funcionales
- Migrar cada ruta con su lógica:
  - `/caja` (tabla ultra-compacta estilo Legacy)
  - `/lista-dia` (grid de estatus clínicos)
  - `/cubiculo` (grid de cubículos + sesiones)
  - `/reportes` (4 tipos con filtro de fecha)
  - `/medico-dia` (asignación)
  - `/catalogos` (CRUD genérico)
  - `/admin/usuarios` y `/admin/perfiles`
  - `/paciente/$id` (detalle)
  - `/cambio-clave`, `/importacion`, `/externos`, `/paquetes`

### Fase 6 — Polish
- Error boundaries
- Loading states (Suspense + skeletons)
- Responsive final (iPadOS landscape/portrait)
- `.env.example` documentado

---

## 8. Lo Que NO Se Toca

- **ETL** (`etl/`) — se queda como proyecto independiente
- **Firestore Security Rules** — se asumen ya configuradas
- **Firebase Auth users** — los usuarios existentes siguen funcionando
- **Estructura de colecciones** — no se modifica ningún documento/colección

---

## 9. Dependencias Principales (package.json)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "firebase": "^11.10.0",
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-table": "^8.x",
    "@tanstack/react-form": "^1.x",
    "@tanstack/db": "latest",
    "tailwind-merge": "^2.x",
    "clsx": "^2.x",
    "class-variance-authority": "^0.7.x",
    "lucide-react": "^0.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-dropdown-menu": "^2.x",
    "@radix-ui/react-slot": "^1.x"
  },
  "devDependencies": {
    "vite": "^6.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.9",
    "tailwindcss": "^4.x",
    "@tailwindcss/vite": "^4.x",
    "eslint": "^9.x",
    "@tanstack/router-plugin": "^1.x"
  }
}
```

---

## 10. Resumen Ejecutivo

| Aspecto | Antes | Después |
|---------|-------|---------|
| Framework | Next.js 14 (SSR) | Vite (SPA estática) |
| Auth | Admin SDK + cookies | Client SDK + `onAuthStateChanged` |
| Data | Server Components + Admin SDK | TanStack Query + Client SDK |
| Tables | HTML tables con estilos inline | TanStack Table + shadcn |
| Forms | Server Actions + `useActionState` | TanStack Form |
| Routing | Next.js App Router | TanStack Router (file-based) |
| UI | Estilos inline / CSS Modules | shadcn/ui + Tailwind |
| Deploy | Firebase Hosting + SSR (Cloud Functions) | Firebase Hosting (SPA estática) |
| Servidor | Node.js runtime requerido | Sin servidor (client-only) |

---

**¿Aprobado? Si confirmas, procedo con la implementación completa.**
