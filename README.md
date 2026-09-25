# TeamTick

Listas de tareas compartidas para proyectos en equipo.

- **Proyectos**: agrupan listas (etapas, partes, áreas del proyecto…).
- **Listas**: cada una con sus tareas. Se pueden crear, renombrar, reordenar y eliminar.
- **Tareas**: título, notas, responsable, fecha límite; se pueden completar, editar, mover de lista y eliminar.
- **Invitaciones por link**: cualquier integrante genera un link (vence a los 7 días, se puede revocar). Quien lo abre e inicia sesión se suma al proyecto con acceso a todas sus listas.
- **Tiempo real**: lo que hace un integrante aparece al instante en la pantalla de los demás.
- Roles: el **dueño** puede eliminar el proyecto y quitar integrantes; los **miembros** pueden editar todo lo demás y salir del proyecto.

Stack: Next.js 16 (App Router, Server Actions) · Supabase (Postgres, Auth, Realtime, RLS) · Tailwind CSS 4.

---

## Desarrollo local

Requisitos: Node 20.9+, Docker y el [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
npm run db:start        # levanta Supabase local y aplica supabase/migrations
```

Copiá `.env.example` a `.env.local` y completalo con lo que imprime `supabase status`
(`API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`):

```bash
npm run dev             # http://localhost:3000
```

En local la confirmación por email está desactivada: al registrarte entrás directo.
Los emails (si los activás) se ven en Mailpit: http://127.0.0.1:54324

Otros scripts:

| Script              | Qué hace                                                    |
| ------------------- | ----------------------------------------------------------- |
| `npm run db:reset`  | Recrea la base local y vuelve a aplicar las migraciones     |
| `npm run db:types`  | Regenera `src/lib/database.types.ts` desde la base local    |
| `npm run typecheck` | Chequeo de tipos                                            |
| `npm run lint`      | ESLint                                                      |

---

## Deploy (Supabase + GitHub + Vercel)

### 1. Crear el proyecto en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com/dashboard).
2. Aplicá el esquema de la base. Cualquiera de las dos opciones:
   - **SQL Editor**: pegá el contenido de `supabase/migrations/20260924000000_init.sql` y ejecutalo.
   - **CLI**:
     ```bash
     supabase link --project-ref <tu-project-ref>
     supabase db push
     ```
3. En **Project Settings → API** (o el botón **Connect**) copiá dos valores. Los vas a
   cargar como variables de entorno en Vercel en el paso 3:
   - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
   - *Publishable key* (o la *anon key*) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Si en tu compu querés usar esta base en vez de la local, poné esos mismos
   valores en `.env.local`.

### 2. Subir a GitHub

```bash
git add -A
git commit -m "TeamTick: primera versión"
git remote add origin git@github.com:<tu-usuario>/team-tick.git
git push -u origin main
```

`.env.local` no se sube (está en `.gitignore`).

### 3. Deploy en Vercel

1. En [vercel.com/new](https://vercel.com/new) importá el repo (Vercel detecta Next.js solo).
2. En **Environment Variables** cargá los dos valores que copiaste de Supabase en el paso 1:
   - `NEXT_PUBLIC_SUPABASE_URL` = la *Project URL*
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = la *Publishable key*
3. Deploy.

### 4. Configurar Auth en Supabase

En **Authentication → URL Configuration**:

- **Site URL**: la URL de producción, p. ej. `https://team-tick.vercel.app`
- **Redirect URLs**: agregá `https://team-tick.vercel.app/**`
  (y si querés que funcione en los previews de Vercel: `https://*-<tu-equipo>.vercel.app/**`)

**Confirmación de email** (Authentication → Sign In / Providers → Email → *Confirm email*):

- **Opción simple (recomendada para un equipo chico)**: desactivala. Al registrarse, cada uno entra directo.
- **Si la dejás activa**: el link del email confirma la cuenta y vuelve a la app. Para que funcione
  aunque se abra en otro dispositivo, cambiá el template **Confirm signup**
  (Authentication → Emails) para que el link sea:
  ```html
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirmar cuenta</a>
  ```
  Así además se conserva el link de invitación con el que se registró la persona.
  Ojo: el servidor de email incluido en Supabase tiene un límite bajo de envíos por hora.

### 5. Invitar a tu compañero

1. Creá un proyecto.
2. Tocá **Invitar → Generar link de invitación** y copialo.
3. Tu compañero abre el link, crea su cuenta (o inicia sesión) y toca **Unirme al proyecto**.

> En el plan gratuito, Supabase pausa los proyectos después de una semana sin actividad.
> Se reactivan desde el dashboard.

---

## Cómo está armado

```
src/
  proxy.ts                         Refresca la sesión y protege rutas (antes "middleware")
  app/
    (app)/                         Rutas con sesión (header + contenido)
      page.tsx                     Dashboard de proyectos
      projects/[projectId]/        Tablero: listas, tareas, invitar, ajustes, tiempo real
    login/                         Ingresar / crear cuenta
    invite/[token]/                Vista previa y aceptación de invitaciones (pública)
    auth/confirm/route.ts          Destino de los links de confirmación de email
    actions/                       Server Actions (proyectos, listas, tareas, invitaciones, auth)
  components/                      UI compartida (botones, modales, menú, toasts)
  lib/
    supabase/                      Clientes de Supabase (browser, server, proxy)
    database.types.ts              Tipos generados de la base
supabase/
  migrations/                      Esquema, funciones, triggers y políticas RLS
```

**Seguridad**: toda la autorización vive en la base de datos con Row Level Security.
Un usuario solo puede leer o modificar proyectos de los que es integrante; sumarse a un
proyecto solo es posible con un link de invitación válido (función `accept_invite`), y
las columnas sensibles (como `owner_id`) no se pueden modificar desde la API.

**Tiempo real**: el tablero se suscribe a los cambios de `tasks`, `lists`, `project_members`
y `projects` vía Supabase Realtime y recarga los datos del servidor cuando otro integrante
modifica algo. Las acciones propias se muestran al instante con actualizaciones optimistas.
