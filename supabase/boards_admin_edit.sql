-- Solo admin puede editar o borrar tableros
-- Ejecutar en SQL Editor de Supabase

drop policy if exists "boards_update" on public.boards;
drop policy if exists "boards_delete" on public.boards;

create policy "boards_update" on public.boards
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "boards_delete" on public.boards
  for delete to authenticated
  using (public.is_admin());
