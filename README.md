# ALCARAVAN-APP

Plataforma de gestión integral para una banda de música: miembros, contabilidad, facturación,
inventario, stock, escuela, eventos, asistencia y archivo de partituras.

**Single tenant**: cada despliegue pertenece a una única banda. Sus datos viven en la tabla
`band_profile` (fila única, `id = 1`); ninguna otra entidad lleva `band_id`.

Este repositorio contiene la **Fase 0 · Foundation**: auth con RBAC, band-profile, members mínimo,
documents, audit, infraestructura y el esqueleto del frontend. Los módulos de negocio se construyen encima.

## Stack y decisiones

| Área            | Elección                                     | Por qué                                                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo        | pnpm workspaces + Turborepo                  | Instalación estricta (sin dependencias fantasma) y caché de lint/test/build en CI.                                                                                                                                                                                                                                                          |
| API             | NestJS 11 (monolito modular), REST + OpenAPI | Módulos de dominio con límites explícitos; Swagger en `/api/v1/docs`.                                                                                                                                                                                                                                                                       |
| ORM             | **Prisma 6** (no TypeORM)                    | Esquema declarativo y tipos generados; migraciones SQL versionadas y revisables; `migrate diff` permite detectar drift en CI. TypeORM ofrece más control con decoradores, pero su tipado y sus migraciones autogeneradas son más frágiles. Fijado a 6.x: Prisma 7 cambia el cliente y la configuración, y su migración es una tarea aparte. |
| Validación API  | class-validator                              | Se integra con el plugin de Swagger (documenta los DTO sin duplicar). Zod se usa en el frontend y para validar variables de entorno.                                                                                                                                                                                                        |
| Frontend        | React 19 + Vite + React Router 7             |                                                                                                                                                                                                                                                                                                                                             |
| Estado servidor | TanStack Query                               | Caché, reintentos y cancelación de peticiones.                                                                                                                                                                                                                                                                                              |
| Estado global   | Context API                                  | Solo hay sesión. Zustand se añadirá cuando haya estado de UI compartido que lo justifique. Sin Redux.                                                                                                                                                                                                                                       |
| Formularios     | React Hook Form + Zod                        |                                                                                                                                                                                                                                                                                                                                             |
| UI              | **Tailwind 4 + shadcn/ui** (no MUI)          | Los componentes viven en el repo (`src/components/ui`), son accesibles (Radix) y se adaptan a la identidad de la banda sin pelear con un tema. Más ligero para la PWA móvil. Si en algún módulo hace falta una tabla muy compleja se puede añadir TanStack Table.                                                                           |
| i18n            | react-i18next                                | Código en inglés, interfaz en español; añadir idiomas es añadir un JSON.                                                                                                                                                                                                                                                                    |
| Calendario      | FullCalendar (pendiente, módulo `events`)    |                                                                                                                                                                                                                                                                                                                                             |

## Estructura

```
.
├─ apps/
│  ├─ api/                        NestJS
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma         modelo de datos (snake_case en BD vía @map)
│  │  │  ├─ migrations/           SQL versionado (incluye CHECKs y triggers)
│  │  │  └─ seed.ts               catálogo de roles/permisos + primer admin (idempotente)
│  │  └─ src/
│  │     ├─ config/               validación de variables de entorno (Zod)
│  │     ├─ common/               contexto de petición (trace_id), errores, filtro global, pipes, DTO base
│  │     ├─ infrastructure/prisma/
│  │     ├─ health/
│  │     └─ modules/
│  │        ├─ auth/              login, refresh, logout, /me, invitaciones, guards y decoradores
│  │        ├─ band-profile/      fila única de la banda
│  │        ├─ members/           miembros (mínimo)
│  │        ├─ documents/         subida, metadatos, URL firmada (S3)
│  │        └─ audit/             audit_log append-only
│  └─ web/                        React + Vite
│     └─ src/
│        ├─ api/                  cliente HTTP, refresh single-flight, tipos, i18n de errores
│        ├─ app/                  router.tsx (rutas por permiso) y modules.ts (navegación)
│        ├─ features/             auth, dashboard, members, band-profile
│        ├─ layouts/              AppLayout (sidebar + cabecera, responsive)
│        ├─ components/ui/        shadcn/ui (button, input, label, card)
│        └─ i18n/
├─ packages/shared/               catálogo de permisos y roles + formato de error (API y web)
├─ docker-compose.yml             desarrollo: postgres + minio + api + web
├─ .github/workflows/ci.yml       lint → test → build → migraciones → imágenes → deploy
└─ turbo.json, pnpm-workspace.yaml, tsconfig.base.json
```

## Arranque

Requisitos: Node 22, pnpm 10 (`corepack enable`) y Docker.

**Opción A · todo en Docker**

```bash
docker compose up --build
```

- Web: http://localhost:5173 · API: http://localhost:3000/api/v1 · Swagger: http://localhost:3000/api/v1/docs
- MinIO (consola): http://localhost:9001
- Primer acceso: `admin@alcaravan.local` / `change-me-please-123` (cámbialo en `.env`, ver `SEED_ADMIN_*`).

**Opción B · infraestructura en Docker, apps en el host** (recarga más rápida)

```bash
cp .env.example .env
pnpm install
pnpm infra:up          # postgres + minio + bucket
pnpm db:deploy         # aplica las migraciones
pnpm db:seed           # roles, permisos y primer admin
pnpm dev               # api :3000 y web :5173 (Vite reenvía /api a la API)
```

| Comando                                      | Qué hace                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| `pnpm lint` · `typecheck` · `test` · `build` | Igual que en CI (vía Turborepo).                                |
| `pnpm db:migrate`                            | Crea/aplica una migración de desarrollo (`prisma migrate dev`). |
| `pnpm db:deploy`                             | Aplica migraciones pendientes (staging/producción).             |
| `pnpm format`                                | Prettier sobre todo el repo.                                    |

## Seguridad

- **Deny by default**: `JwtAuthGuard` y `PermissionsGuard` son globales. Toda ruta exige token salvo `@Public()`;
  los permisos se declaran con `@RequirePermissions('members.read')`. El frontend solo oculta UI.
- **Tokens**: access token JWT de 15 min, solo en memoria del navegador. Refresh token opaco, de un solo uso,
  guardado como hash SHA-256, en cookie `httpOnly` + `SameSite=Strict` con ruta limitada a `/api/v1/auth`.
  Cada refresco lo rota; reutilizar un token ya rotado (fuera de una ventana de gracia de 10 s) revoca toda la
  familia y queda auditado. Tope absoluto de sesión de 90 días.
- **Permisos** siempre leídos de BD en cada petición: quitar un rol surte efecto de inmediato.
- **Contraseñas** con Argon2id; el login compara contra un hash señuelo si el usuario no existe (sin enumeración por
  tiempo) y tiene límite de 5 intentos/min por IP.
- **Documentos**: bucket privado, el `storage_key` nunca sale en un DTO, la descarga es una URL firmada de 2 min,
  el tipo se valida por firma del fichero (no por extensión ni `Content-Type`).
- **Auditoría**: `audit_log` es append-only _a nivel de base de datos_ (triggers que rechazan UPDATE/DELETE/TRUNCATE),
  guarda actor, IP, `trace_id` y estado antes/después con los campos sensibles redactados. Los cambios auditados y su
  entrada de auditoría se confirman en la misma transacción.

## Módulos económicos (Fase 1)

Integran en la API y la base de datos las herramientas de _Alcaraván Gestión 2.13_ (la app local con IndexedDB),
con la misma identidad visual (azul noche `#142841`, dorado `#d5b16a`, logotipo oficial en `apps/web/public/brand/`).

| Grupo                | Módulo API (`/api/v1/...`)                                                                | Qué hace                                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facturación y gastos | `billing` (`/billing/clients`, `invoices`, `suppliers`, `expenses`, `recurring-expenses`) | Series ALC (banda) y ESC (escuela) con numeración atómica por año, IGIC/IRPF, PDF del gasto en `documents`.                                                                                                            |
| Escuela y personal   | `school`, `payroll`                                                                       | Alumnado, tarifas (IGIC incluido), generación mensual de cuotas → factura ESC; nóminas.                                                                                                                                |
| Contabilidad         | `accounting`, `treasury`, `budgets`                                                       | Diario inmutable (Debe = Haber comprobado en BD), propuestas de asiento, cola de pendientes, mayor, sumas y saldos, resultados, balance, cierre con apertura; extractos CSV y conciliación; presupuesto frente a real. |
| Fiscalidad y ayudas  | `tax`, `grants`                                                                           | Libros de IGIC trimestral (modelo 420), retenciones (111/190), subvenciones y su justificación.                                                                                                                        |
| Gestión interna      | `internal-cash`                                                                           | Caja de rifas, refuerzos y eventos fuera de la contabilidad oficial.                                                                                                                                                   |
| Inicio               | `dashboard`                                                                               | Indicadores y avisos según los permisos de cada rol.                                                                                                                                                                   |

- **Importes** en céntimos (`BIGINT`), tipos en puntos básicos (700 = 7 %). La API recibe `_cents` y porcentajes.
- **Asientos**: no se editan ni borran (triggers); se corrigen con una reversión. Un ejercicio cerrado no admite asientos.
  El cierre exige que el ejercicio siguiente aún no tenga asientos (su apertura es el primero).
- **Permisos** nuevos: `billing.*`, `school.*`, `payroll.*`, `accounting.read/post/close`, `treasury.*`, `budgets.*`,
  `tax_reports.read`, `grants.*`, `internal_cash.*` (asignación por rol en `packages/shared/src/permissions.ts`).
- Los informes contables y fiscales son orientativos: la interfaz lo advierte y no sustituyen a la asesoría.

## Convenciones

- **Nombres**: BD y JSON de la API en `snake_case`; TypeScript en `camelCase`. Prisma mapea con `@map`/`@@map` y
  cada DTO de respuesta tiene un `from()` explícito que decide qué campos salen (nunca se devuelve una fila de Prisma).
  Tablas en singular (`member`, `audit_log`). Código, endpoints y permisos en inglés; interfaz en español.
- **Errores** con formato único `{ code, message, details, trace_id }`. `code` es estable y el frontend traduce por `code`.
- **Dinero**: `*_cents BIGINT` (EUR, moneda de `band_profile`). Nunca `float`.
- **Fechas**: `timestamptz` en UTC; fechas sin hora como `date` (`YYYY-MM-DD` en JSON).
- **Migraciones**: SQL solo ASCII (los comentarios con tildes rompen en bases con collation no UTF-8). Nunca se edita una
  migración ya aplicada; CI aplica todas desde cero y falla si `schema.prisma` no coincide con lo migrado.
- **Límites entre módulos**: cada módulo es propietario de sus tablas y expone un servicio público. Otros módulos importan
  su `Module` y usan ese servicio (p. ej. `documents` llama a `MembersService.assertExists`); nunca consultan sus tablas.
- **Base de datos** en español (`es-ES`, ICU) sobre imagen Debian: la ordenación y el `ILIKE` con ñ y tildes lo necesitan.

## Añadir un módulo de negocio

1. Permisos nuevos en `packages/shared/src/permissions.ts` y su asignación en `ROLE_PERMISSIONS`.
2. Modelos en `schema.prisma` → `pnpm db:migrate` → revisar el SQL generado.
3. `apps/api/src/modules/<modulo>/` con `module`, `service`, `controller` y `dto` (`@RequirePermissions` en cada endpoint,
   `AuditService.record(..., tx)` en cada escritura sensible). Registrarlo en `app.module.ts`.
4. Frontend: entrada en `app/modules.ts`, ruta bajo `RequirePermission` en `app/router.tsx` (carga `lazy`), textos en `es.json`.

## Estado de verificación

Comprobado en local: `lint`, `typecheck`, tests (API 29, web 19) y `build` de ambas apps; migración inicial aplicada
sobre PostgreSQL real sin drift; seed idempotente; 44 comprobaciones de extremo a extremo contra la API en marcha (login,
rotación y reutilización de refresh token, RBAC, invitaciones, auditoría, formato de error, límite de intentos);
invariantes de BD (triggers append-only, CHECKs); y flujo de UI en un navegador real (login, sesión que sobrevive a
recargar, rutas por permiso, logout, vista móvil).

Módulos económicos: migración `20261112000000_finance` aplicada sin drift, prueba de extremo a extremo de todo el circuito
(facturas y numeración, cuotas → facturas ESC, gastos con IRPF, nóminas, asientos y reversiones, conciliación bancaria,
IGIC, retenciones, presupuestos, subvenciones, caja interna, cierre y apertura) y capturas de todas las pantallas nuevas.

**No verificado** (no había Docker en la máquina de desarrollo): que `docker compose up` arranque completo, los Dockerfile,
y la subida/descarga real de documentos contra MinIO (la validación previa a S3 sí está probada). Los workflows de CI
no se han ejecutado en GitHub.

## Pendiente (fuera de la Fase 0)

- Job de retención que purgue de S3 los documentos con borrado lógico y los refresh tokens caducados.
- Backups automáticos de PostgreSQL con restauración probada, y `docker-compose` de staging/producción.
- Destino real de despliegue en el job `deploy` de CI (hoy es un paso que falla a propósito si se activa sin configurar).
- Pantalla de aceptación de invitación (el endpoint existe) y envío por email (módulo `notifications` + BullMQ).
- Política de acceso por tipo de documento (p. ej. `IDENTITY` con permiso propio) cuando se suba el DNI de los miembros.
- Búsqueda insensible a tildes (`unaccent`), PWA (`vite-plugin-pwa`) y generación de tipos del frontend desde OpenAPI.
