-- Prioridad en cards (ejecutar en SQL Editor de Supabase)
alter table public.cards
  add column if not exists priority text
  check (priority is null or priority in ('low', 'medium', 'high', 'urgent'));

comment on column public.cards.priority is 'low | medium | high | urgent | null';
