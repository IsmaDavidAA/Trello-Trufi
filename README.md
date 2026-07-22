# Trufi Board

Tablero estilo Trello/Vikunja para el equipo Trufi: **Vite + React + Supabase**, deploy en **GitHub Pages**.

## Qué incluye

- Login solo con cuentas invitadas por un **admin**
- **Equipos** con descripción Markdown + links, CRUD, miembros
- **Tableros** múltiples (CRUD), color, equipo asociado, descripción MD
- **Kanban**: columnas y tarjetas, drag & drop, fecha, color, done
- Ready para GitHub Pages + Supabase Auth/DB/RLS

## Setup rápido

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. SQL Editor → pega y ejecuta `supabase/schema.sql`
3. Authentication → Providers → Email: habilita email/password
4. **Importante (invitaciones):** Authentication → Providers → Email → desactiva **Confirm email**.  
   Si queda activo, cada signup intenta mandar correo y en el plan gratis aparece `email rate limit exceeded`. Con invitaciones propias no hace falta confirmar por email.
5. (Opcional) Authentication → Settings: desactiva “Allow new users to sign up” **después** de crear el primer admin; el flujo `/invite/:token` sigue pudiendo usar `signUp` si el provider lo permite, o crea usuarios desde el dashboard. El trigger rechaza emails sin invitación (excepto el primer usuario).

**Primer admin:** registra el primer usuario desde `/login` creando la cuenta en Auth Dashboard (Add user) **o** deja signup abierto una sola vez: el primer `auth.users` se convierte en admin automáticamente.

Copia URL y anon key a `.env`:

```bash
cp .env.example .env
```

### 2. Local

```bash
npm install
npm run dev
```

### 3. Invitar al equipo

1. Entra como admin → **Usuarios** → Nueva invitación  
2. Comparte el enlace `/invite/<token>`  
3. La persona define contraseña y entra

### 4. GitHub Pages (importante: secrets)

El archivo `.env` **no se sube** a GitHub. En el servidor hay que definir secrets:

1. Ve a: https://github.com/IsmaDavidAA/Trello-Trufi/settings/secrets/actions  
2. **New repository secret** y crea exactamente estos dos:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | la misma URL de tu `.env` (`https://….supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | la misma anon key de tu `.env` |

3. **Settings → Pages** → Source: **GitHub Actions**
4. Vuelve a desplegar: Actions → **Deploy GitHub Pages** → **Run workflow**,  
   o haz push a `main`.
5. En Supabase → **Authentication** → **URL Configuration**:
   - Site URL: `https://ismadavidaa.github.io/Trello-Trufi/`
   - Redirect URLs: `https://ismadavidaa.github.io/Trello-Trufi/**`

Las rutas usan **HashRouter** (`…/Trello-Trufi/#/boards/...`) para que el reload no dé 404 en Pages.

Si faltan los secrets, el workflow falla con un error claro.

## Modelo de datos (resumen)

| Tabla | Uso |
|-------|-----|
| `profiles` | usuarios + rol admin/member |
| `invites` | invitaciones admin-only |
| `teams` / `team_members` | equipos |
| `boards` | tableros |
| `columns` | listas Kanban |
| `cards` | tareas (color, due_date, done, md) |

## Scripts

```bash
npm run dev      # desarrollo
npm run build    # build producción
npm run preview  # preview local del build
```
