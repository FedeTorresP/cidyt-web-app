# Historial de Cambios — cidyt-web-app (IPadCIDyT)

Todos los cambios notables en este proyecto se documentan en este archivo.
El formato sigue **[Keep a Changelog](https://keepachangelog.com/)** y el versionado **[Semántico](https://semver.org/)**.

---

## [3.1.1] — 2026-06-16

### Seguimiento de Paciente, Modal Obs mejorado, Estado compartido

#### Agregado
- **Página "Seguimiento del Paciente"** (`/paciente/$seguimientoId`): formulario completo con 4 cards (Estado General, Médico y Antropometría, Resultados, Est. Adicionales) y tabla "Estudios del Paquete" con 20 filas fijas
- **Hook compartido `use-lista-dia`**: migración de estado local a TanStack Query cache para sincronización bidireccional entre lista-dia, seguimiento y modal Obs
- **Función `useUpdatePacienteCache`**: actualización optimista del cache compartido desde cualquier página
- **Toast nativo** en página de seguimiento (sin dependencia externa) para feedback de guardado

#### Modificado
- **Modal "Datos del Paciente" (Obs)**: rediseño con más espaciado (20px entre filas), contenedores tipo input disabled (`#f3f4f6`, border, border-radius: 6px), labels arriba del valor, grid por filas con proporciones definidas, badges circulares para Desayuno y pill para Tarjeta
- **Columna Vínculos** en lista-dia: migrada de `<a href="#/...">` a `<Link>` de TanStack Router con tipado de params
- **Dropdown "Paciente listo para salir"**: eliminada opción "Cancelado" (solo No, Si, Paciente Terminó su visita)
- **Tabla "Estudios del Paquete"** en seguimiento: muestra siempre los 20 estudios fijos con dropdown de médico filtrado por especialidad y fallback a todos
- **Desayuno y Estatus Valpac**: cambios en seguimiento se reflejan inmediatamente en lista-dia (cache compartido)

---

## [3.1.0] — 2026-06-15 [`f1ffc35`...`55d3702`](https://github.com/Medica-Sur-TI/cidyt-web-app/compare/f1ffc35...55d3702)

### Mi Perfil y Accesos, SAP Integration ADC, Timezone Utility

#### Agregado
- **Página unificada "Mi Perfil y Accesos"** (`/mi-perfil`): consolida las pantallas `/cambio-clave` y `/admin/usuarios` en una sola vista con control segmentado (Tabs) estilo Apple HIG
- **Tab Mi Perfil** (todos los roles): correo institucional y No. Empleado en solo lectura, edición de nombre con cuadrícula de 3 campos (Nombre, Apellido Paterno, Apellido Materno), cambio de contraseña vía Firebase Auth
- **Tab Gestión de Usuarios** (solo admin): TanStack Table con buscador global, ordenamiento por columnas, DropdownMenu de acciones (Editar, Enviar enlace de acceso, Desactivar)
- **Estrategia de campos aditivos**: escritura simultánea de `nombre`, `apellidoPaterno`, `apellidoMaterno` junto a `nombreCompleto` (fuente de verdad) — cero migración de documentos legacy
- **Normalización NFC** obligatoria en todos los campos de texto libre antes de escribir a Firestore
- **Flujo de alta ABM**: sin campo de password manual, disparo automático de `sendPasswordResetEmail` al crear usuario
- **PERFIL_COLORS**: constante con formas geométricas (rombos, triángulos, círculos) y colores por rol para badges
- Componentes UI reutilizables: `<Tabs>`, `<DropdownMenu>`, `<Dialog>` (patrones shadcn, Tailwind CSS puro + Radix)
- Footer corporativo global en AppShell: "Desarrollado por: Médica Sur – Sistemas y T.I. · Copyright © {año}"
- **SAP Integration Service**: soporte para Application Default Credentials (ADC) en despliegues GCP (Cloud Run / GKE / GCE) sin necesidad de JSON de Service Account
- **Timezone utility** (`src/lib/timezone.ts`): helpers `nowMX`, `formatDateMX`, `formatTimeMX` con `date-fns-tz` para manejo DST-safe de fechas en zona America/Mexico_City

#### Modificado
- Menú lateral (FALLBACK_MENU): reemplazadas entradas de "Cambio de Clave" y "Conf Perfiles/Usuario" por "Mi Perfil y Accesos" con ruta `/mi-perfil`
- Vistas lista-dia, caja y reportes migradas a usar helpers de timezone (eliminado manejo manual de offsets)
- SAP Integration Service README actualizado con documentación de ambos paths de deployment (Docker Compose local vs Cloud Run)
- `services/users.ts`: interfaz `UsuarioFirestore` extendida con campos opcionales aditivos
- `hooks/use-usuarios.ts`: mutaciones actualizadas para aceptar payload de campos desglosados

---

## [3.0.3] — 2026-06-09 [`9764e5f`...`beb85df`](https://github.com/Medica-Sur-TI/cidyt-web-app/compare/9764e5f...beb85df)

### Login 2-step flow, Code-Splitting y Sidebar Legacy

#### Agregado
- Login de 2 pasos con paridad visual legacy: Paso 1 (Credenciales) + Paso 2 (Selección de Horario MATUTINO/VESPERTINO)
- Logo corporativo Médica Sur (`LogoMS1.svg`) y favicons integrados desde el proyecto Legacy a `/public`
- Code-splitting con TanStack Router lazy routes (`reportes`, `caja`, `lista-dia`, `cubiculo`, `admin.perfiles`)
- `manualChunks` en Vite para separar Firebase y TanStack en vendors independientes
- Sidebar refactorizado con paridad 100% legacy: Header con logo + versión, UserBlock con avatar verde + TurnoPill dinámica, navegación con borde izquierdo verde en activo
- Botón hamburger toggle (✕/☰) con posición legacy

#### Corregido
- Tecla Enter no activaba "Iniciar sesión" — eliminado `@tanstack/react-form` del login, reemplazado por formulario nativo con `useRef`
- Botón "Cerrar sesión" no funcionaba — agregada navegación a `/login` tras `signOut` y limpieza de `sessionStorage`
- Botón "Regresar" en Paso 2 entraba al sistema en vez de volver — ahora ejecuta `logout()` antes de cambiar step (evita redirect por guard de auth)

#### Modificado
- Bundle reducido de 912KB (chunk único) a chunks distribuidos: Firebase ~462KB, TanStack ~190KB, App ~240KB + lazy routes ~22KB
- Sidebar: ancho fijo 200px, targets táctiles 44px (Apple HIG), `touch-action: manipulation`
- `AppShell.tsx`: refactorizado con layout fixed, turno desde `sessionStorage`, responsive hamburger

---

## [3.0.2] — 2026-06-09 [`d260a19`...`aef915c`](https://github.com/Medica-Sur-TI/cidyt-web-app/compare/d260a19...aef915c)

### Migración completa a Vite + TanStack (SPA client-side)

#### Agregado
- Vite 6 como build tool y dev server (reemplaza Next.js 14)
- TanStack Router con file-based routing y route guards
- TanStack Query para data fetching y cache (reemplaza Server Components)
- TanStack Table para tablas de datos (reemplaza HTML tables con estilos inline)
- TanStack Form para formularios (reemplaza Server Actions + `useActionState`)
- shadcn/ui como sistema de componentes unificado (Radix + Tailwind CSS v4)
- Design tokens de Médica Sur traducidos a Tailwind CSS v4
- Firebase Client SDK como única capa de auth y datos (sin Admin SDK)
- AuthContext con `onAuthStateChanged` para estado de sesión reactivo
- Route guard `_authenticated.tsx` con `beforeLoad`
- Menú lateral dinámico desde Firestore con filtrado RBAC client-side
- Pipeline CI/CD con GitHub Actions + Docker + Firebase Hosting [`994013c`](https://github.com/Medica-Sur-TI/cidyt-web-app/commit/994013c)
- Secretos centralizados en GCP Secret Manager
- Infraestructura como código con Terraform
- Interfaz optimizada para iPadOS (targets táctiles 44×44px, touch-action manipulation)

#### Eliminado
- Next.js 14 (App Router, Server Components, Server Actions, Middleware)
- Firebase Admin SDK (ya no se usa `verifyIdToken` ni acceso server-side)
- Cookie HTTP-only `__session` (reemplazada por `onAuthStateChanged`)
- Node.js runtime requerido en producción (ahora es SPA estática)
- CSS Modules y estilos inline del legacy
- SSR y Cloud Functions para hosting

#### Modificado
- Arquitectura: de SSR (Next.js) a SPA estática (Vite)
- Auth: de Admin SDK + cookies a Client SDK + `onAuthStateChanged`
- Data layer: de Server Components a TanStack Query hooks
- UI: de estilos inline/CSS Modules a shadcn/ui + Tailwind
- Deploy: de Firebase Hosting + SSR a Firebase Hosting (SPA estática)
- RBAC: de verificación server-side a Custom Claims extraídos en cliente

---

## [3.0.1] — 2026-06-09 [`aef915c`](https://github.com/Medica-Sur-TI/cidyt-web-app/commit/aef915c)

### Corregido
- **Fix deploy (auth/invalid-api-key):** Corregido formato del secreto `FIREBASE_CONFIG_SECRET` en GCP Secret Manager. El secreto estaba almacenado como objeto JSON pero el workflow lo escribe directo a `.env.local`, que requiere formato `KEY=VALUE` para que Vite embeba las variables correctamente en el bundle.

---

## [3.0.0] — 2026-06-08

### Migración a Firebase (sobre Next.js)

#### Agregado
- Firebase Auth con proveedor email/password (reemplaza NextAuth)
- Cloud Firestore como base de datos (reemplaza PostgreSQL/Cloud SQL)
- Firebase Hosting con soporte SSR para Next.js
- Servicio RBAC basado en Custom Claims + colecciones Firestore
- Auditoría transaccional atómica en Firestore
- Menú lateral dinámico desde colección `menu_items`

#### Eliminado
- NextAuth (`next-auth`, route handler, SessionProvider)
- PostgreSQL y Drizzle ORM
- Infraestructura Docker/Cloud Build del legacy
- Migraciones SQL y esquemas Drizzle

#### Modificado
- Middleware migrado de Edge Runtime a Node.js Runtime
- Sesión basada en cookie HTTP-only con Token_ID de Firebase Auth
- Queries migradas de Drizzle ORM a Firestore Admin SDK

---

## [2.5.4 — Legacy] — 2026-05-28

### Agregado
- Card "Información del Paciente" en pantalla de detalle: muestra datos demográficos y clínicos relevantes en caja consolidada
- Auto-carga de factura existente: sistema detecta si hay factura previa para el paciente y la carga automáticamente en flujo de retiro

### Modificado
- Ciclo de vida del retiro de enfermería: optimizado flujo visual con confirmación explícita mediante botón "Confirmar Retiro" para mejorar UX y prevenir cambios accidentales

### Corregido
- Ajustes de estilos en card de paciente para alineación con grid de iPad

---

## [2.0.0-dev — Legacy] — 2026-06-03

### UI/UX

#### Agregado
- **LoginForm refactorizado** `[467aa66]`: Componente completamente reescrito con Tailwind CSS y variables de diseño (tokens CSS). Flujo de 2 pasos (`login` + `horario`) con control de horarios laborales y spinners animados de carga
- Scaffolding inicial de v2 con flat file layout, Next.js 14, TypeScript y Drizzle ORM

#### Modificado
- **Pantalla de Login:** Fondo de contenedor principal reemplazado de gris genérico por token de color primario institucional (`--color-primario`, azul `#0A1F5C`) para paridad visual en iPad y consistencia con el sistema de diseño
- **Design tokens del Legacy:**
  - Paleta institucional Médica Sur: primario `#0A1F5C`, acento `#00A651`
  - Paddings, gaps y sombras extraídos de CSS Modules para traducción a Tailwind
  - Tipografía base 13px SF Pro / system-ui
  - Rejillas ultra-compactas para tablas optimizadas en iPad
  - Targets táctiles mínimos de 44×44px

#### Referencia de Estilos Legacy (para paridad visual)
- `caja.module.css`: Tablas y rejillas ultra-compactas para pantallas iPad en modo landscape
- Selectores complejos de layout para paneles de cubículos, caja y lista del día
- Design tokens dispersos en múltiples `.module.css` y `globals.css`
- Densidad de datos clínica: máximo aprovechamiento de viewport sin scroll innecesario

---

## Tipos de Cambios

| Etiqueta | Significado |
|----------|-------------|
| **Agregado** | Nuevas funcionalidades o componentes |
| **Modificado** | Cambios a comportamiento o apariencia existente |
| **Corregido** | Corrección de bugs |
| **Eliminado** | Funcionalidad deprecada o removida |
| **Seguridad** | Parches de seguridad o ajustes de acceso |

---

## Versionado

`MAJOR.MINOR.PATCH`

- **MAJOR**: cambios incompatibles (migraciones de stack)
- **MINOR**: nuevas funcionalidades retrocompatibles
- **PATCH**: correcciones de bugs
