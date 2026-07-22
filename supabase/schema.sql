-- Trufi Board — schema para Supabase
-- Ejecutar en SQL Editor del proyecto Supabase

-- Perfiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- Invites (solo admin crea cuentas vía enlace)
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null default '',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Equipos
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description_md text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  primary key (team_id, user_id)
);

-- Tableros
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description_md text not null default '',
  color text not null default '#0f766e',
  team_id uuid references public.teams(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Columnas (listas)
create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Cards
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.columns(id) on delete cascade,
  title text not null,
  description_md text not null default '',
  color text,
  due_date date,
  done boolean not null default false,
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_assignees (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (card_id, user_id)
);

-- Helpers
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

-- Auto profile on signup (si hay invite pendiente)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv
  from public.invites
  where lower(email) = lower(new.email)
    and used_at is null
  order by created_at desc
  limit 1;

  if inv.id is null and not exists (select 1 from public.profiles) then
    -- Primer usuario = admin bootstrap
    insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'admin');
    return new;
  end if;

  if inv.id is null then
    raise exception 'No hay invitación válida para %', new.email;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(inv.full_name, ''), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))),
    inv.role
  );

  update public.invites set used_at = now() where id = inv.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.card_assignees enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- Invites (solo admin lista; el público usa RPC por token)
create policy "invites_admin_all" on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.get_invite_by_token(invite_token text)
returns table (
  id uuid,
  email text,
  full_name text,
  token text,
  role text,
  used_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.email, i.full_name, i.token, i.role, i.used_at, i.created_at
  from public.invites i
  where i.token = invite_token and i.used_at is null
  limit 1;
$$;

grant execute on function public.get_invite_by_token(text) to anon, authenticated;

-- Teams (helpers security definer evitan recursión con team_members)
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

-- Team members
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

-- Columns
create policy "columns_select" on public.columns for select to authenticated
  using (public.can_access_board(board_id));
create policy "columns_mutate" on public.columns for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

-- Cards
create policy "cards_select" on public.cards for select to authenticated
  using (
    exists (
      select 1 from public.columns c
      where c.id = column_id and public.can_access_board(c.board_id)
    )
  );
create policy "cards_mutate" on public.cards for all to authenticated
  using (
    exists (
      select 1 from public.columns c
      where c.id = column_id and public.can_access_board(c.board_id)
    )
  )
  with check (
    exists (
      select 1 from public.columns c
      where c.id = column_id and public.can_access_board(c.board_id)
    )
  );

-- Assignees
create policy "assignees_select" on public.card_assignees for select to authenticated using (true);
create policy "assignees_mutate" on public.card_assignees for all to authenticated
  using (
    exists (
      select 1 from public.cards card
      join public.columns c on c.id = card.column_id
      where card.id = card_id and public.can_access_board(c.board_id)
    )
  )
  with check (
    exists (
      select 1 from public.cards card
      join public.columns c on c.id = card.column_id
      where card.id = card_id and public.can_access_board(c.board_id)
    )
  );
