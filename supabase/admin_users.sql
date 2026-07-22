-- Admin: roles, borrar usuarios, reset de contraseña, etc.
-- Ejecutar en SQL Editor de Supabase

-- Tokens de renovación de contraseña (el admin genera el link, sin email)
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.password_reset_tokens enable row level security;

drop policy if exists "prt_admin_all" on public.password_reset_tokens;
create policy "prt_admin_all" on public.password_reset_tokens
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Asegurar que admin puede actualizar roles de otros
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Borrar usuario Auth (cascade a profiles vía FK)
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admin';
  end if;
  if target_id = auth.uid() then
    raise exception 'No puedes borrarte a ti mismo';
  end if;
  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'Usuario no encontrado';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Crear token de reset (solo admin). Devuelve el token.
create or replace function public.admin_create_password_reset(target_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not public.is_admin() then
    raise exception 'Solo admin';
  end if;
  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'Usuario no encontrado';
  end if;

  -- invalidar tokens previos sin usar
  update public.password_reset_tokens
  set used_at = now()
  where user_id = target_id and used_at is null;

  insert into public.password_reset_tokens (user_id, created_by)
  values (target_id, auth.uid())
  returning token into new_token;

  return new_token;
end;
$$;

revoke all on function public.admin_create_password_reset(uuid) from public;
grant execute on function public.admin_create_password_reset(uuid) to authenticated;

-- Info pública del token (para la página de reset)
create or replace function public.get_password_reset_by_token(reset_token text)
returns table (
  email text,
  full_name text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.email, p.full_name, t.expires_at
  from public.password_reset_tokens t
  join public.profiles p on p.id = t.user_id
  where t.token = reset_token
    and t.used_at is null
    and t.expires_at > now()
  limit 1;
$$;

grant execute on function public.get_password_reset_by_token(text) to anon, authenticated;

-- Completar reset: actualiza password en auth.users
create or replace function public.complete_password_reset(reset_token text, new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  t record;
begin
  if new_password is null or length(new_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;

  select t0.id, t0.user_id into t
  from public.password_reset_tokens t0
  where t0.token = reset_token
    and t0.used_at is null
    and t0.expires_at > now()
  limit 1;

  if t.id is null then
    raise exception 'Enlace inválido o expirado';
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  where id = t.user_id;

  update public.password_reset_tokens
  set used_at = now()
  where id = t.id;
end;
$$;

grant execute on function public.complete_password_reset(text, text) to anon, authenticated;
