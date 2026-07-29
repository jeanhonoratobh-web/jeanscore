-- ============================================================================
-- JeanScore — Votação de atributos dos jogadores (tabela `attribute_ratings`)
-- ----------------------------------------------------------------------------
-- Rode UMA VEZ no Supabase (SQL Editor → New query → cole → Run).
-- Cada usuário vota os atributos de um jogador (0–99) uma vez (pode alterar).
--   • leitura pública  → médias exibidas na carta e no perfil
--   • inserir/atualizar → apenas usuários logados, só as próprias notas
-- ============================================================================

create table if not exists public.attribute_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  player_id   text not null,                       -- squad.id (ex.: 'crz_10')
  attribute   text not null,                       -- ex.: 'Finalização'
  score       int  not null check (score >= 0 and score <= 99),
  created_at  timestamptz not null default now(),
  unique (user_id, player_id, attribute)
);

alter table public.attribute_ratings enable row level security;

drop policy if exists "public read attribute_ratings" on public.attribute_ratings;
create policy "public read attribute_ratings"
  on public.attribute_ratings for select using (true);

drop policy if exists "users insert own attribute_ratings" on public.attribute_ratings;
create policy "users insert own attribute_ratings"
  on public.attribute_ratings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own attribute_ratings" on public.attribute_ratings;
create policy "users update own attribute_ratings"
  on public.attribute_ratings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists attribute_ratings_player_idx on public.attribute_ratings(player_id);
