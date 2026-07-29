-- ============================================================================
-- JeanScore — Admin do elenco (adicionar/editar/remover jogadores)
-- ----------------------------------------------------------------------------
-- Rode UMA VEZ no Supabase (SQL Editor → New query → cole → Run).
-- Requer o supabase-admin.sql (tabela `admins`) já rodado.
-- Mantém leitura pública do elenco e permite que SÓ admins escrevam.
-- ============================================================================

alter table public.squad enable row level security;

drop policy if exists "public read squad" on public.squad;
create policy "public read squad"
  on public.squad for select using (true);

drop policy if exists "admins insert squad" on public.squad;
create policy "admins insert squad"
  on public.squad for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins update squad" on public.squad;
create policy "admins update squad"
  on public.squad for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins delete squad" on public.squad;
create policy "admins delete squad"
  on public.squad for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
