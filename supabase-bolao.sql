-- ============================================================================
-- JeanScore — Bolão Cabuloso (tabela `predictions`)
-- ----------------------------------------------------------------------------
-- Rode UMA VEZ no Supabase (Dashboard → SQL Editor → New query → cole → Run).
-- Cria a tabela de palpites, com segurança (RLS):
--   • leitura pública       → ranking do bolão e palpites dos outros torcedores
--   • inserir/atualizar     → apenas usuários logados, só o próprio palpite,
--                             e SOMENTE até 1 minuto antes do início da partida
--                             (o horário vem de fixtures.ts — epoch em segundos)
--   • 1 palpite por usuário por partida (unique user_id + fixture_id)
--
-- A pontuação NÃO fica no banco: é calculada no site a partir do placar final
-- da partida (fixtures.home_score / away_score):
--   3 pts placar exato · 2 pts vencedor + saldo de gols · 1 pt só o vencedor/empate
-- ============================================================================

create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_name   text not null,                       -- nome exibido no ranking
  fixture_id  text not null,                       -- fixtures.id (ex.: 'j39')
  home_pred   integer not null check (home_pred between 0 and 20),
  away_pred   integer not null check (away_pred between 0 and 20),
  created_at  timestamptz not null default now(),
  unique (user_id, fixture_id)                     -- 1 palpite por jogo/usuário
);

alter table public.predictions enable row level security;

drop policy if exists "public read predictions" on public.predictions;
create policy "public read predictions"
  on public.predictions for select using (true);

-- Inserir: só o próprio palpite e só enquanto faltar mais de 1 min pro jogo.
drop policy if exists "users insert own predictions before kickoff" on public.predictions;
create policy "users insert own predictions before kickoff"
  on public.predictions for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and now() < to_timestamp(f.ts) - interval '1 minute'
    )
  );

-- Atualizar: mesma regra (pode ajustar o palpite até 1 min antes do início).
drop policy if exists "users update own predictions before kickoff" on public.predictions;
create policy "users update own predictions before kickoff"
  on public.predictions for update to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and now() < to_timestamp(f.ts) - interval '1 minute'
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and now() < to_timestamp(f.ts) - interval '1 minute'
    )
  );

create index if not exists predictions_fixture_idx on public.predictions(fixture_id);
create index if not exists predictions_user_idx    on public.predictions(user_id);
