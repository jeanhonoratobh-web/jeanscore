-- ============================================================================
-- JeanScore — Admin (liberar jogos para votação)
-- ----------------------------------------------------------------------------
-- IMPORTANTE: antes de rodar a PARTE 2, garanta que você tem uma conta ativa:
-- abra o site, vá em "Cadastrar" e crie sua conta (ou faça login). Depois
-- confira o e-mail em Authentication → Users.
--
-- Rode este script no Supabase (SQL Editor → New query → cole → Run).
-- ============================================================================

-- ─── PARTE 1: Tabelas e permissões (pode rodar sempre, é seguro) ────────────

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admins enable row level security;

drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row"
  on public.admins for select
  using (auth.uid() = user_id);

alter table public.fixtures enable row level security;

drop policy if exists "public read fixtures" on public.fixtures;
create policy "public read fixtures"
  on public.fixtures for select using (true);

drop policy if exists "admins update fixtures" on public.fixtures;
create policy "admins update fixtures"
  on public.fixtures for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ─── PARTE 2: Tornar-se admin pelo seu e-mail ───────────────────────────────
-- TROQUE 'seu-email@exemplo.com' pelo e-mail com que você se cadastrou no site.
-- (Busca o id real em auth.users. Se o e-mail não existir, não insere nada —
--  nesse caso, cadastre-se no site primeiro e rode a PARTE 2 de novo.)

insert into public.admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;

-- Conferir se deu certo (deve retornar 1 linha com seu id):
-- select * from public.admins;
