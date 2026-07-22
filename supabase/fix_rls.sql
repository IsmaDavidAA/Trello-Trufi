-- Fix RLS: recursión teams ↔ team_members + inserts de boards
-- Ejecutar entero en Supabase → SQL Editor

-- Helpers sin RLS (security definer)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_team_member(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = t_id and tm.user_id = auth.uid()
  );
$$;

create or replace function public.owns_team(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams t
    where t.id = t_id and t.created_by = auth.uid()
  );
$$;

create or replace function public.can_access_board(b_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.boards b
    where b.id = b_id
      and (
        public.is_admin()
        or b.created_by = auth.uid()
        or b.team_id is null
        or public.is_team_member(b.team_id)
      )
  );
$$;

-- Quitar policies viejas
drop policy if exists "teams_select" on public.teams;
drop policy if exists "teams_insert" on public.teams;
drop policy if exists "teams_update" on public.teams;
drop policy if exists "teams_delete" on public.teams;
drop policy if exists "tm_select" on public.team_members;
drop policy if exists "tm_mutate" on public.team_members;
drop policy if exists "boards_select" on public.boards;
drop policy if exists "boards_insert" on public.boards;
drop policy if exists "boards_update" on public.boards;
drop policy if exists "boards_delete" on public.boards;

-- Teams (sin consultar team_members bajo RLS)
create policy "teams_select" on public.teams for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or public.is_team_member(id)
  );

create policy "teams_insert" on public.teams for insert to authenticated
  with check (
    auth.uid() is not null
    and (created_by is null or created_by = auth.uid())
  );

create policy "teams_update" on public.teams for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

create policy "teams_delete" on public.teams for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- Team members (sin consultar teams bajo RLS)
create policy "tm_select" on public.team_members for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or public.owns_team(team_id)
    or public.is_team_member(team_id)
  );

create policy "tm_insert" on public.team_members for insert to authenticated
  with check (
    public.is_admin()
    or public.owns_team(team_id)
    or user_id = auth.uid()
  );

create policy "tm_update" on public.team_members for update to authenticated
  using (public.is_admin() or public.owns_team(team_id))
  with check (public.is_admin() or public.owns_team(team_id));

create policy "tm_delete" on public.team_members for delete to authenticated
  using (public.is_admin() or public.owns_team(team_id) or user_id = auth.uid());

-- Boards
create policy "boards_select" on public.boards for select to authenticated
  using (public.can_access_board(id));

create policy "boards_insert" on public.boards for insert to authenticated
  with check (
    auth.uid() is not null
    and (created_by is null or created_by = auth.uid())
  );

create policy "boards_update" on public.boards for update to authenticated
  using (public.can_access_board(id))
  with check (public.can_access_board(id));

create policy "boards_delete" on public.boards for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- Asegurar que tu usuario sea admin (ajusta el email si hace falta)
-- update public.profiles set role = 'admin' where email = 'TU_EMAIL@ejemplo.com';
