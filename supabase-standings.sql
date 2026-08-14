-- ============================================================================
-- JeanScore — Classificação (Brasileirão) + Status das Competições
-- ----------------------------------------------------------------------------
-- Rode este script UMA VEZ no Supabase (Dashboard → SQL Editor → New query →
-- cole tudo → Run). Ele cria as duas tabelas, libera leitura pública (para a
-- chave publishable/anon do site poder ler) e popula com os dados reais.
--
-- Depois, para ATUALIZAR a classificação, é só editar as linhas em
-- Table Editor → standings (ou rodar de novo os INSERT ... on conflict abaixo).
-- ============================================================================

-- ─── Tabela de classificação do Brasileirão ────────────────────────────────
create table if not exists public.standings (
  position        integer primary key,   -- Colocação (#)
  team            text    not null,       -- Time
  played          integer not null default 0,  -- Jogos (J)
  wins            integer not null default 0,  -- Vitórias (V)
  draws           integer not null default 0,  -- Empates (E)
  losses          integer not null default 0,  -- Derrotas (D)
  goals_for       integer not null default 0,  -- Gols Pró (GP)
  goals_against   integer not null default 0,  -- Gols Contra (GC)
  goal_diff       integer not null default 0,  -- Saldo de Gols (SG)
  points          integer not null default 0,  -- Pontos (Pts)
  is_cruzeiro     boolean not null default false
);

alter table public.standings enable row level security;
drop policy if exists "public read standings" on public.standings;
create policy "public read standings" on public.standings for select using (true);

-- ─── Tabela de status das demais competições (copas) ───────────────────────
create table if not exists public.competition_status (
  id            text primary key,
  competition   text not null,   -- Nome da competição
  status        text,            -- Status (Em andamento / Encerrado ...)
  stage         text,            -- Fase
  next_match    text,            -- Próximo Jogo
  next_date     text,            -- Data
  sort          integer not null default 0
);

alter table public.competition_status enable row level security;
drop policy if exists "public read competition_status" on public.competition_status;
create policy "public read competition_status" on public.competition_status for select using (true);

-- ─── Dados: Classificação Brasileirão 2026 (CBF, rodada 22) ─────────────────
insert into public.standings
  (position, team, played, wins, draws, losses, goals_for, goals_against, goal_diff, points, is_cruzeiro) values
  (1,'Palmeiras',21,14,5,2,38,16,22,47,false),
  (2,'Flamengo',20,11,6,3,37,18,19,39,false),
  (3,'Athletico-PR',21,11,4,6,28,19,9,37,false),
  (4,'Fluminense',22,9,8,5,31,26,5,35,false),
  (5,'Cruzeiro',22,9,6,7,30,31,-1,33,true),
  (6,'Bahia',21,8,8,5,29,25,4,32,false),
  (7,'RB Bragantino',20,9,4,7,26,20,6,31,false),
  (8,'Botafogo',21,8,6,7,35,33,2,30,false),
  (9,'Coritiba',22,8,6,8,27,29,-2,30,false),
  (10,'Atlético-MG',21,8,5,8,27,27,0,29,false),
  (11,'Corinthians',21,7,8,6,22,20,2,29,false),
  (12,'São Paulo',21,7,5,9,26,25,1,26,false),
  (13,'Vitória',21,7,5,9,22,31,-9,26,false),
  (14,'Grêmio',21,6,7,8,24,27,-3,25,false),
  (15,'Mirassol',21,6,5,10,24,30,-6,23,false),
  (16,'Santos',20,5,7,8,29,33,-4,22,false),
  (17,'Internacional',21,5,7,9,23,27,-4,22,false),
  (18,'Remo',22,5,7,10,26,36,-10,22,false),
  (19,'Vasco da Gama',20,5,6,9,23,31,-8,21,false),
  (20,'Chapecoense',21,1,7,13,20,43,-23,10,false)
on conflict (position) do update set
  team = excluded.team, played = excluded.played, wins = excluded.wins,
  draws = excluded.draws, losses = excluded.losses, goals_for = excluded.goals_for,
  goals_against = excluded.goals_against, goal_diff = excluded.goal_diff,
  points = excluded.points, is_cruzeiro = excluded.is_cruzeiro;

-- ─── Dados: Status das copas (edite livremente no Table Editor) ─────────────
insert into public.competition_status
  (id, competition, status, stage, next_match, next_date, sort) values
  ('libertadores','Copa Libertadores','Em andamento','Oitavas de final','Cruzeiro x Flamengo','13/08/2026',1),
  ('copa_brasil','Copa do Brasil','Em andamento','Oitavas de final','Chapecoense x Cruzeiro','02/08/2026',2),
  ('mineiro','Campeonato Mineiro','Encerrado','Campeão','—','—',3)
on conflict (id) do update set
  competition = excluded.competition, status = excluded.status, stage = excluded.stage,
  next_match = excluded.next_match, next_date = excluded.next_date, sort = excluded.sort;
