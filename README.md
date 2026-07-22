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
4. (Recomendado) Authentication → Settings: desactiva “Allow new users to sign up” **después** de crear el primer admin, **o** deja signup activo solo vía flujo `/invite/:token` (el trigger rechaza emails sin invitación, excepto el primer usuario)

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

### 4. GitHub Pages

1. Settings → Pages → Source: GitHub Actions  
2. Secrets del repo:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push a `main` (workflow en `.github/workflows/deploy.yml`)
4. En Supabase Auth → URL Configuration agrega tu URL de Pages (redirect)

Si el repo se llama `Trello-Trufi`, el workflow ya usa `VITE_BASE=/Trello-Trufi/`.

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
