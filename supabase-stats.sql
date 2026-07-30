-- JeanScore — Estatísticas por partida
-- Adiciona colunas opcionais de estatísticas na tabela `fixtures`.
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- Todas as colunas são inteiras e podem ficar em branco (NULL) para jogos
-- que ainda não têm estatísticas cadastradas.

alter table public.fixtures
  add column if not exists possession_home    int,
  add column if not exists possession_away    int,
  add column if not exists shots_home          int,
  add column if not exists shots_away          int,
  add column if not exists shots_target_home   int,
  add column if not exists shots_target_away   int,
  add column if not exists corners_home        int,
  add column if not exists corners_away        int,
  add column if not exists fouls_home          int,
  add column if not exists fouls_away          int,
  add column if not exists yellow_home         int,
  add column if not exists yellow_away         int;
