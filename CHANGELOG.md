# Historial de Cambios — cidyt-web-app (IPadCIDyT)

Todos los cambios notables en este proyecto se documentan en este archivo.
El formato sigue **[Keep a Changelog](https://keepachangelog.com/)** y el versionado **[Semántico](https://semver.org/)**.

---

## [3.2.2] — 2026-06-18 [`35a30e0`](https://github.com/Medica-Sur-TI/cidyt-web-app/commit/35a30e0)

### Optimización de densidad vertical para iPad — Lista de Pacientes & Lista de Estudios Caja

#### Modificado
- **Lista de Pacientes** (`/lista-dia`): reducir padding vertical en toolbar (10→6px), leyenda (12→6px), headers (py-4→py-1.5), filas (py-14→py-4), cuadros de estudio (28→22px), badge desayuno (57×28→50×22). Agregar sticky thead dinámico debajo del toolbar con ResizeObserver. Redistribuir ancho Médico Internista (80→100px) / Vínculos (60→40px). Agrandar ícono padecimiento (10→16px) con margen derecho
- **Lista de Estudios — Caja** (`/lista-caja`): misma compactación de toolbar, headers y filas. Badges de Desayuno/Tarjeta cambiados de cuadrados sólidos a texto coloreado (legacy style). Celdas de estudio sin padding (0px). Header color corregido a `var(--color-primario)`. Sticky thead dinámico debajo del toolbar
- **`globals.css`**: `h1.page-title` margin-bottom reducido de 16px a 6px

---

## [3.2.2] — 2026-06-18 [`69485b3`...`c660056`](https://github.com/Medica-Sur-TI/cidyt-web-app/compare/69485b3...c660056)

### Médico por Ubicación y Día — Página Lugares

#### Agregado
- **Página "Médico por Ubicación y Día"** (`/lugares`): reescritura completa del stub placeholder con paridad operativa y estética vs legacy v2.5.4
- **Sección formulario "Nueva Asignación"**: grid 2×2 responsive (Médico, Lugar de Estudio, Fecha, Horario) con selects cargados desde catálogos Firestore, fecha por defecto hoy en zona America/Mexico_City, validación obligatoria y detección de duplicados
- **Sección tabla "Asignaciones del Día"**: toolbar con date picker + botón "Actualizar", tabla estilizada con columnas Médico/Lugar/Horario/Fecha/Eliminar, filas alternadas, botón destructive por fila con `confirm()`
- **Hook `use-medico-dia.ts`**: `useMedicoDiaAsignaciones(fecha)` (query con resolución de nombres), `useCrearAsignacion()` (mutation con check de duplicado), `useEliminarAsignacion()` (borrado lógico `activo: false`)
- **Hook `use-lugares.ts`**: `useLugaresActivos()` — query a colección `lugares` where `activo==true` orderBy nombre
- **Hook `use-horarios.ts`**: `useHorariosActivos()` — query a colección `horarios` where `activo==true` orderBy nombre
- **Interface `MedicoLugarDia`** en `src/types/models.ts`: tipo para la colección `medico_lugar_dia`

#### Modificado
- **`medico-dia.tsx`**: reemplazado con redirect a `/lugares` (la funcionalidad ahora vive en la ruta lugares)

---

## [3.2.2] — 2026-06-17 [`69485b3`](https://github.com/Medica-Sur-TI/cidyt-web-app/commit/69485b3)

### Lista de Cubículos — Dashboard de Monitoreo

#### Agregado
- **Página "Lista de Cubículos"** (`/cubiculo/listado`): dashboard dark-theme full-screen para pantalla TV de enfermeras con grid 7 columnas de cards fijos (150-190px), reloj en tiempo real (5s refresh), leyenda de estatus y timer por sesión activa
- **Hook `useCubiculosListado()`**: polling cada 30s a `GET /api/cubiculo/listado` con fallback a mock (20 cubículos)
- **Sistema de alertas por tiempo**: 0-15 min verde, 16-30 min naranja, 31+ min rojo con parpadeo (`animate-cubiculos-pulse`). Color unificado entre timer, borde lateral y dot
- **Animación `cubiculos-pulse`** en `globals.css` (keyframes + clase utilitaria)
- **Estilo condicional del hamburguesa** en AppShell: transparente sin fondo en ruta `/cubiculo/listado`

#### Modificado
- **`globals.css`**: eliminado `margin: 0; padding: 0` del reset `*` (redundante con preflight de Tailwind CSS v4, causaba conflictos de especificidad)
- **Footer de cubículos**: copyright a la izquierda, leyenda de ocupación a la derecha

---

## [3.2.1] — 2026-06-17 [`8ced5fb`](https://github.com/Medica-Sur-TI/cidyt-web-app/commit/8ced5fb)

### Estudios Externos + Consolidación sap-pipeline

#### Agregado
- **Página "Estudios Externos"** (`/externos`): formulario de registro con campos Fecha, Nombre del Paciente, Nombre del Estudio y Observaciones (textarea full-width). Validación frontend, banners de éxito/error con auto-dismiss, limpieza de campos (excepto fecha) tras éxito
- **Ruta `/estudios-externos`** como alias adicional (ambas rutas renderizan el mismo formulario)
- **Hook `use-estudios-externos`**: mutation `useRegistrarEstudioExterno()` con `POST /api/externos`, Bearer token Firebase Auth e invalidación de queryKey `['estudios-externos']`
- **`sap-pipeline/`**: microservicio FastAPI consolidado (reemplaza `sap-integration-service`) para ingesta SAP → Firestore vía JSON
- **`sap-pipeline/app/core/normalizer.py`**: normalización Unicode NFC integrada en los servicios de pacientes y paquetes antes de escribir a Firestore
- **`sap-pipeline/samples/`**: XML de admisión legacy como referencia histórica

#### Eliminado
- **`sap-integration-service/`**: movido a repositorio Legacy (reemplazado por `sap-pipeline`)

---

## [3.2.0] — 2026-06-17 [`01db6d4`...`c55be39`](https://github.com/Medica-Sur-TI/cidyt-web-app/compare/01db6d4...c55be39)

### Registro de Pacientes, Lista de Pacientes Caja, Caja y Facturación (detalle)

#### Agregado
- **Página "Registro de Pacientes"** (`/paciente`): vista completa con dos modos internos (Lista + Formulario) sin rutas separadas
- **Vista Lista**: card con header azul oscuro, selector de fecha, tabs "Activos/Cancelados" con contadores, tabla con turno (badge circular), nombre, paquete, botones Editar (azul info) y Cancelar (rojo outline con confirmación inline)
- **Vista Formulario**: grid 2 columnas con campos Primer Nombre, Segundo Nombre, Apellido Paterno/Materno, Fecha Nac., Género, Historia, Paquete (catálogo dinámico), Empresa (catálogo dinámico), Turno (1-99). Botón submit dinámico: verde "Registrar Paciente" / azul oscuro "Guardar Cambios"
- **Flujo cancelar paciente**: confirmación inline (¿Confirmar? / No) sin `confirm()` nativo — soft-delete con PATCH `Activo: 0`
- **Flujo restaurar paciente**: botón "↩ Restaurar" en tab Cancelados con PATCH `Activo: 1`
- **Hook `use-registro-pacientes`**: queries (`usePacientesDelDia`, `useCatalogos`, `usePacienteDetalle`) + mutations (`useCrearPaciente`, `useEditarPaciente`, `useToggleActivo`) con Bearer token Firebase Auth y fallback a mock
- **Página "Lista de Pacientes Caja"** (`/lista-caja`): tabla ultra-compacta de seguimiento para el área de Caja con 20 columnas de estudios (read-only), columnas extras (Edad, Paquete, Peso, Talla, Desayuno, Tarjeta Ent. Res.) y Médico Internista como última columna
- **Hook `use-lista-caja`**: TanStack Query con endpoint `GET /api/caja?fecha=` y fallback a mock (15 pacientes sincronizados con lista-dia)
- **Página "Caja y Facturación"** (`/caja/$seguimientoId`): detalle de facturación accesible desde el nombre del paciente en lista-caja, con 4 secciones (Información del Paciente, Datos Factura, Estudios Adicionales, Facturas, Paciente se Retira)
- **Hook `use-caja-detalle`**: query + 3 mutations (guardar/actualizar factura, eliminar factura soft-delete, confirmar egreso) con invalidación automática
- **Sección "Paciente se Retira"**: implementa el ciclo de vida completo (Estado A: no listo / Estado B: enfermería marcó listo / Estado C: egresado) con control de flujo inter-área
- **Ruta `/caja/$seguimientoId`** con lazy loading (placeholder de detalle de facturación)

#### Modificado
- **Ruta `/paciente`**: convertida de placeholder a lazy route con componente completo `RegistroPacientesPage`
- **Menú de navegación (fallback)**: "Lista de Pacientes Caja" ahora apunta a `/lista-caja` en vez de `/caja`
- **Datos mock sincronizados**: los 15 pacientes son idénticos entre `use-lista-dia`, `use-lista-caja` y `use-registro-pacientes` para consistencia cross-page
- **Color "No Incluido" en lista-caja**: cuadros de estudio no realizados se muestran con gris oscuro sólido (`#374151`) en vez de borde transparente — exclusivo de la vista Caja

#### Eliminado
- **Página "Caja" antigua** (`/caja`): tabla de facturas con DataTable eliminada — reemplazada por `/lista-caja` + `/caja/$seguimientoId`
- **Hook `use-facturas`**: removido (solo era usado por la página de Caja anterior)

---

## [3.1.1] — 2026-06-16 [`27fa8ff`...`de7ac01`](https://github.com/Medica-Sur-TI/cidyt-web-app/compare/27fa8ff...de7ac01)

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
