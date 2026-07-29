-- ============================================================================
-- JeanScore — Admin avançado: adicionar jogos + escolher jogadores por partida
-- ----------------------------------------------------------------------------
-- Rode UMA VEZ no Supabase (SQL Editor → New query → cole → Run).
-- Requer que o supabase-admin.sql já tenha sido rodado (tabela `admins`).
-- ============================================================================

-- ─── Permitir que admins INSIRAM novos jogos em fixtures ────────────────────
drop policy if exists "admins insert fixtures" on public.fixtures;
create policy "admins insert fixtures"
  on public.fixtures for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ─── Jogadores disponíveis para votação em cada partida ─────────────────────
-- Se uma partida NÃO tiver linhas aqui, o site mostra o elenco inteiro
-- (comportamento padrão). Se tiver, mostra apenas os jogadores selecionados.
create table if not exists public.fixture_players (
  fixture_id text not null,      -- fixtures.id
  player_id  text not null,      -- squad.id
  primary key (fixture_id, player_id)
);

alter table public.fixture_players enable row level security;

drop policy if exists "public read fixture_players" on public.fixture_players;
create policy "public read fixture_players"
  on public.fixture_players for select using (true);

drop policy if exists "admins insert fixture_players" on public.fixture_players;
create policy "admins insert fixture_players"
  on public.fixture_players for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins delete fixture_players" on public.fixture_players;
create policy "admins delete fixture_players"
  on public.fixture_players for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
