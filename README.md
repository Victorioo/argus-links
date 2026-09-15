# Report Hub

Repositorio interno del equipo para reportes HTML: cada persona tiene su cuenta,
sube el `.html` y queda publicado en un link fijo y compartible
(`/r/<slug>`). Actualizar un reporte reemplaza el contenido sin generar un
link nuevo — así se evita terminar con decenas de deploys sueltos de lo mismo.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind + Prisma/PostgreSQL +
Auth.js (login por email/contraseña).

## Cómo funciona

- **Cuentas**: registro con nombre, email y contraseña (hash con bcrypt). Todo
  lo que no sea `/r/<slug>` o `/login` / `/register` requiere estar logueado.
- **Reportes**: se guardan en Postgres, con el HTML como texto (hasta 4MB por
  archivo — ver "Límites" abajo). Cualquier persona logueada puede subir o
  editar cualquier reporte (equipo chico y de confianza); queda registro de
  quién lo creó y quién lo actualizó por última vez.
- **Link público**: `/r/<slug>` sirve el HTML tal cual, sin login — funciona
  igual que un link de Netlify para compartir afuera del equipo.
- **Editar sin romper el link**: en `/reports/<id>` se puede reemplazar el
  archivo, cambiar título/descripción, o (si hace falta) cambiar el slug.

## Setup local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env` y completar:
   - `DATABASE_URL`: connection string de Postgres (ver "Base de datos" abajo).
   - `AUTH_SECRET`: generarlo con `npx auth secret` (o `openssl rand -base64 32`).
   - `ALLOWED_EMAIL_DOMAIN` (opcional): si se define, solo se pueden registrar
     cuentas con ese dominio de email (ej. `tuempresa.com`).

3. Sincronizar el schema con la base:

   ```bash
   npm run db:push
   ```

4. Levantar el servidor:

   ```bash
   npm run dev
   ```

## Base de datos (Postgres)

Se probó y quedó pensado para **Neon** (tiene free tier y se integra directo
con Vercel), pero cualquier Postgres gestionado sirve igual (Supabase,
Railway, RDS, etc.):

1. Crear un proyecto en [neon.tech](https://neon.tech).
2. Copiar el connection string (con `?sslmode=require`) a `DATABASE_URL`.
3. Correr `npm run db:push` una vez para crear las tablas.

## Deploy en Vercel

1. Subir este repo a GitHub (o el proveedor git que usen) e importarlo en
   [vercel.com/new](https://vercel.com/new).
2. En las variables de entorno del proyecto en Vercel, cargar:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `ALLOWED_EMAIL_DOMAIN` (opcional)
3. Deploy. El build ya corre `prisma generate` automáticamente
   (`package.json` → `build`), y `postinstall` también lo dispara por las
   dudas.
4. Si es la primera vez que se conecta esa base, correr `npm run db:push`
   localmente (apuntando a `DATABASE_URL` de producción) antes del primer
   deploy, para crear las tablas.

## Límites a tener en cuenta

- **Tamaño de archivo**: 4MB por reporte. Es un margen deliberadamente por
  debajo del límite de Vercel para el body de una función serverless
  (~4.5MB). Si suben reportes con imágenes en base64 muy pesadas, van a
  chocar con esto — lo más simple es alojar esas imágenes aparte (ej. un
  bucket S3/Vercel Blob) y referenciarlas por URL en vez de embeberlas.
- **Acceso**: cualquier persona logueada puede editar o borrar cualquier
  reporte (no hay owners/roles todavía). Para un equipo chico está bien; si
  hace falta restringir esto a "solo el autor" o agregar roles de admin, es
  un cambio chico en `src/app/api/reports/[id]/route.ts`.
- **Sin historial de versiones**: al reemplazar el HTML de un reporte se
  pierde la versión anterior (solo queda quién y cuándo lo actualizó). Se
  puede agregar versionado más adelante si hace falta.

## Estructura

```
src/
  app/
    page.tsx              → dashboard (lista + búsqueda)
    login/, register/     → auth
    reports/new/          → subir reporte
    reports/[id]/         → editar/borrar reporte
    r/[slug]/route.ts     → sirve el HTML público
    api/                  → endpoints (auth, register, reports)
  auth.ts                 → configuración de Auth.js
  proxy.ts                → protección de rutas (antes "middleware.ts" en Next < 16)
  lib/prisma.ts           → cliente de Prisma
prisma/schema.prisma      → modelos User y Report
```
