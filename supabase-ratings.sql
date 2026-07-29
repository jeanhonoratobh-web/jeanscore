-- ============================================================================
-- JeanScore — Votação da torcida (tabela `ratings`)
-- ----------------------------------------------------------------------------
-- Rode UMA VEZ no Supabase (Dashboard → SQL Editor → New query → cole → Run).
-- Cria a tabela de notas, com segurança (RLS):
--   • leitura pública  → feed "Avaliações Recentes" e médias dos jogadores
--   • inserir/atualizar → apenas usuários logados, e só as próprias notas
-- ============================================================================

create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_name   text not null,                          -- nome exibido no feed
  player_id   text not null,                          -- squad.id (ex.: 'crz_10')
  fixture_id  text not null,                          -- fixtures.id (ex.: 'j39')
  score       numeric(3,1) not null check (score >= 0 and score <= 10),
  created_at  timestamptz not null default now(),
  unique (user_id, player_id, fixture_id)             -- 1 nota por jogador/jogo/usuário
);

alter table public.ratings enable row level security;

drop policy if exists "public read ratings" on public.ratings;
create policy "public read ratings"
  on public.ratings for select using (true);

drop policy if exists "users insert own ratings" on public.ratings;
create policy "users insert own ratings"
  on public.ratings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own ratings" on public.ratings;
create policy "users update own ratings"
  on public.ratings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists ratings_player_idx  on public.ratings(player_id);
create index if not exists ratings_created_idx on public.ratings(created_at desc);
