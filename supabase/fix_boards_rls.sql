-- Ejecutar en SQL Editor (arregla boards + backfill membresías)
-- Si una policy no existe, el DROP IF EXISTS no falla.

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
        or public.owns_team(b.team_id)
      )
  );
$$;

-- Quien creó un equipo debe ser miembro lead
insert into public.team_members (team_id, user_id, role)
select t.id, t.created_by, 'lead'
from public.teams t
where t.created_by is not null
on conflict (team_id, user_id) do nothing;

-- Policies boards desde cero
drop policy if exists "boards_select" on public.boards;
drop policy if exists "boards_insert" on public.boards;
drop policy if exists "boards_update" on public.boards;
drop policy if exists "boards_delete" on public.boards;

create policy "boards_insert" on public.boards
  for insert to authenticated
  with check (auth.uid() is not null and created_by = auth.uid());

-- SELECT directo (no solo vía función) para que RETURNING del insert funcione
create policy "boards_select" on public.boards
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin()
    or team_id is null
    or public.is_team_member(team_id)
    or public.owns_team(team_id)
  );

create policy "boards_update" on public.boards
  for update to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_team_member(team_id)
    or public.owns_team(team_id)
  )
  with check (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_team_member(team_id)
    or public.owns_team(team_id)
  );

create policy "boards_delete" on public.boards
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- Columns: permitir si puedes ver el board
drop policy if exists "columns_select" on public.columns;
drop policy if exists "columns_mutate" on public.columns;

create policy "columns_select" on public.columns
  for select to authenticated
  using (public.can_access_board(board_id));

create policy "columns_insert" on public.columns
  for insert to authenticated
  with check (public.can_access_board(board_id));

create policy "columns_update" on public.columns
  for update to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

create policy "columns_delete" on public.columns
  for delete to authenticated
  using (public.can_access_board(board_id));
