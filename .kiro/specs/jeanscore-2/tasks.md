# Implementation Plan: JeanScore 2.0

## Overview

Este plano converte o design do JeanScore 2.0 em passos incrementais de codificação em **React 18 + TypeScript estrito + Vite**, seguindo a regra de dependência das camadas: fundação (projeto, build gate, PWA) → tipos → infraestrutura (Cache, SupabaseClient) → domínio (funções puras + testes de propriedade) → services com injeção de dependências → autenticação → contexto/hooks → router/guards → temas/i18n → biblioteca de componentes → páginas → wiring, PWA e remoção do legado. Cada etapa constrói sobre a anterior e termina integrada, sem código órfão.

A camada `domain` permanece agnóstica de framework (importa apenas de `types`), e todo o cálculo de gamificação é delegado a funções puras. Os testes baseados em propriedades usam **Vitest + fast-check**; cada propriedade P1–P17 da seção "Correctness Properties" do design é implementada como uma sub-tarefa própria e opcional (`*`), anotada com o número da propriedade e a cláusula de requisito que valida, com no mínimo 100 iterações (`{ numRuns: 100 }`). O mapeamento por arquivo de teste segue a tabela de cobertura do design (`serialization.test.ts` P1/P2, `rarity.test.ts` P3, `scoring.test.ts` P4/P5/P10/P12, `filters.test.ts` P6/P7/P9, `search.test.ts` P8/P13, `cache.test.ts` P11, `fanScore.test.ts` P14/P15, `teamOfMonth.test.ts` P16, `achievements.test.ts` P17).

## Tasks

- [x] 1. Fundação do projeto, build gate e PWA
  - [x] 1.1 Inicializar projeto React 18 + TypeScript estrito + Vite com estrutura de diretórios em camadas
    - Configurar `vite.config.ts` com `base` para o subpath do GitHub Pages e code splitting por rota (chunks via `React.lazy`)
    - Configurar `tsconfig.json` com `strict: true`
    - Criar a estrutura `src/{types,domain,services,components,pages,router,theme,i18n,hooks,context}` conforme o design
    - _Requirements: 1.1, 1.2, 1.3, 1.10_
  - [x] 1.2 Configurar ferramentas de teste e lint
    - Adicionar Vitest (execução única `vitest run`), fast-check, `@testing-library/react` e `jsdom` como dependências de dev; configurar ESLint com `strict`
    - _Requirements: 1.9_
  - [x] 1.3 Configurar o build gate de CI em `.github/workflows/deploy.yml`
    - Rodar, nesta ordem, `tsc --noEmit`, `eslint` e `vitest run` **antes** de `vite build`, bloqueando o deploy em qualquer falha
    - Configurar `404.html` para redirecionar ao `index.html` preservando o path (SPA routing no GitHub Pages) e o `base` de assets
    - _Requirements: 1.9, 1.10, 12.3, 12.4_
  - [x] 1.4 Configurar PWA via `vite-plugin-pwa`
    - Gerar `manifest.webmanifest` (nome, ícones, `theme_color` a partir dos tokens, `display: standalone`) e service worker Workbox com pré-cache do app shell e runtime cache das respostas do Supabase (fonte offline)
    - _Requirements: 34.1, 34.2, 34.3_

- [x] 2. Tipos de domínio, linhas do Supabase, configuração data-driven e chaves de i18n
  - [x] 2.1 Criar interfaces das entidades de domínio em `types/domain.ts`
    - Definir `Player`, `Fixture`, `GameScore`, `PermanentScore`, `User`, `Lineup`, `RankingEntry`, `UserProfile`, `Achievement`, `AchievementDef`, `Badge`, `Collection`, `Prediction`, `CraqueVote`, `ActivityItem`, `TimelineMilestone` com campos opcionais de extensão futura (`achievements?`, `favorited?`, `premium?`)
    - _Requirements: 1.12, 5.3_
  - [x] 2.2 Criar tipos de linha crua do Supabase em `types/supabase.ts`
    - Definir `SupabaseSquadRow`, `SupabaseFixtureRow`, `SupabaseGameScoreRow`, `SupabaseUserRow`, `SupabasePermanentScoreRow`, `SupabaseEscalacaoRow`, `SupabaseCraqueVoteRow`, `SupabasePredictionRow`, `SupabaseFanScoreRow`, `SupabaseAchievementRow`, `SupabaseOnboardingRow` e o tipo `Result<T>`
    - _Requirements: 1.6, 5.3_
  - [x] 2.3 Definir tipos de configuração data-driven
    - `FanScoreConfig` (`actionPoints`, `levelThresholds`), `FanScoreAction`, `PredictionConfig`, `AchievementCondition` e catálogos de `Collection` como objetos de dados
    - _Requirements: 9.7, 10.1, 23.4_
  - [x] 2.4 Definir o tipo `I18nKey` em `i18n/keys.ts`
    - União de literais em inglês para todas as chaves de UI (fonte técnica única das strings)
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 3. Infraestrutura de dados (Cache e SupabaseClient)
  - [x] 3.1 Implementar `Cache` (`services/cache.ts`) com TTL configurável, `getStale`, `invalidate` e `sweep`
    - TTL padrão de 5 minutos, configurável por chamada; `getStale` ignora TTL para o stale fallback; `sweep` remove entradas expiradas
    - _Requirements: 1.7, 1.8_
  - [x] 3.2 Escrever teste de propriedade para o `Cache` em `cache.test.ts`
    - **Property 11: Cache set/get é idempotente para chave repetida**
    - **Validates: Requirements 1.7, 32.3**
  - [x] 3.3 Implementar `SupabaseClient` tipado (`services/supabase-client.ts`) encapsulando todo o REST
    - Métodos `get/post/patch/delete` retornando `Result<T>`; header `Prefer: resolution=merge-duplicates` em upserts; status fora de 2xx vira `{ ok: false, error, status, code }` com SQLSTATE
    - _Requirements: 1.6, 5.4_
  - [x] 3.4 Escrever testes unitários do `SupabaseClient`
    - Mock de fetch para respostas 2xx e não-2xx, verificando o mapeamento para `Result<T>` e a propagação de `code`/`status`
    - _Requirements: 1.6, 31.4_

- [x] 4. Camada domain — serialização, scoring e rarity
  - [x] 4.1 Implementar `domain/serialization.ts` (mapeamento Supabase↔domínio e (de)serialização de notas)
    - `toFixture`/`toFixtureRow`, `toPlayer`, `toGameScore`, `serializeScore`/`deserializeScore` tratando `stadium = null` e scores nulos
    - _Requirements: 1.5, 20.3, 20.10_
  - [x] 4.2 Escrever teste de propriedade para round-trip de Avaliação em `serialization.test.ts`
    - **Property 1: Round-trip de Avaliação (serialização/deserialização)**
    - **Validates: Requirements 1.5, 20.3, 20.10**
  - [x] 4.3 Escrever teste de propriedade para round-trip de Fixture em `serialization.test.ts`
    - **Property 2: Round-trip de Fixture (Supabase → Domínio → Supabase)**
    - **Validates: Requirements 1.5, 20.10**
  - [x] 4.4 Implementar `domain/scoring.ts` (`normalizeScore`, `isValidScore`, `calcAverage`, `calcStdDev`)
    - `normalizeScore` faz clamp em [0,10] com passo 0.5; `isValidScore` rejeita valores fora de [0,10]; `calcAverage`/`calcStdDev` sobre listas de notas
    - _Requirements: 20.2, 20.6, 26.1_
  - [x] 4.5 Escrever teste de propriedade para normalização (limites e passo) em `scoring.test.ts`
    - **Property 4: Normalização de nota (limites e passo)**
    - **Validates: Requirements 20.2**
  - [x] 4.6 Escrever teste de propriedade para média/desvio padrão em `scoring.test.ts`
    - **Property 5: Média invariante à ordem e dentro dos limites**
    - **Validates: Requirements 20.6, 26.1**
  - [x] 4.7 Escrever teste de propriedade para idempotência da normalização em `scoring.test.ts`
    - **Property 10: Normalização de nota é idempotente**
    - **Validates: Requirements 20.2**
  - [x] 4.8 Escrever teste de propriedade para rejeição de nota inválida em `scoring.test.ts`
    - **Property 12: Rejeição de nota inválida**
    - **Validates: Requirements 20.2**
  - [x] 4.9 Implementar `domain/rarity.ts` (`calcRarity`, `mapScoreToRating`)
    - Faixas Bronze (`<6`) / Prata (`6..<7`) / Ouro (`7..<8`) / Lendária (`>=8`); mapeamento 0–10 → 0–99
    - _Requirements: 15.2, 15.3_
  - [x] 4.10 Escrever teste de propriedade para raridade e rating em `rarity.test.ts`
    - **Property 3: Raridade determinística e monotônica da Carta_FIFA**
    - **Validates: Requirements 15.2, 15.3**

- [x] 5. Camada domain — filtros, busca, ranking e estatísticas
  - [x] 5.1 Implementar `domain/filters.ts` (`filterByPosition`, `filterCombined`, `sortPlayers`)
    - Filtro por posição, filtros combinados com lógica AND e ordenação por nota (sem nota ao final) / posição (GK→DEF→MID→ATT, alfabético dentro do grupo)
    - _Requirements: 14.1, 15.5, 15.6, 15.7_
  - [x] 5.2 Escrever teste de propriedade para filtro por posição em `filters.test.ts`
    - **Property 6: Filtro por posição preserva o total (particionamento)**
    - **Validates: Requirements 15.5**
  - [x] 5.3 Escrever teste de propriedade para ordenação em `filters.test.ts`
    - **Property 7: Ordenação é permutação da entrada com ordem correta**
    - **Validates: Requirements 15.6, 15.7**
  - [x] 5.4 Escrever teste de propriedade para filtros combinados em `filters.test.ts`
    - **Property 9: Filtros combinados são AND (monotonicidade restritiva)**
    - **Validates: Requirements 14.1**
  - [x] 5.5 Implementar `domain/search.ts` (`normalizeText`, `search`)
    - Busca insensível a acento e caixa, subconjunto da entrada e robusta a metacaracteres de regex (nunca lança)
    - _Requirements: 13.8, 13.9_
  - [x] 5.6 Escrever teste de propriedade para busca insensível a acento/caixa em `search.test.ts`
    - **Property 8: Busca é subconjunto e insensível a acento/caixa**
    - **Validates: Requirements 13.8, 13.9**
  - [x] 5.7 Escrever teste de propriedade para robustez da busca em `search.test.ts`
    - **Property 13: Busca com caracteres especiais não lança exceção**
    - **Validates: Requirements 13.8**
  - [x] 5.8 Implementar `domain/ranking.ts` (`buildRankings`)
    - Categorias: média geral, mais consistente (mín. 3 partidas, via `calcStdDev`), mais votos, melhor por posição, partida mais bem avaliada; elegibilidade, ordenação e filtro por competição
    - _Requirements: 26.1, 26.2, 26.3_
  - [x] 5.9 Escrever testes unitários para `ranking.ts`
    - Elegibilidade (mínimo de partidas), ordem decrescente, filtro por competição e empates
    - _Requirements: 26.1, 26.3_
  - [x] 5.10 Implementar `domain/stats.ts` (`buildHistogram`, `buildEvolution`, `trendingPlayers`, `strengthsWeaknesses`, melhor/pior)
    - Histograma de 10 faixas, evolução cronológica, jogadores em alta/baixa, forças/fraquezas e tendências
    - _Requirements: 16.5, 16.8, 16.11, 24.4, 24.5_
  - [x] 5.11 Escrever testes unitários para `stats.ts`
    - Casos de borda: menos de 2 partidas, listas vazias, empates e ausência de votos
    - _Requirements: 16.8, 24.1_

- [x] 6. Camada domain — gamificação (Fan Score, conquistas, Time do Mês, palpites)
  - [x] 6.1 Implementar `domain/fanScore.ts` (`applyFanScore`, `fanLevel`, `levelIndex`, `progressToNext`)
    - Cálculo data-driven via `FanScoreConfig`; níveis Iniciante→Torcedor→Apaixonado→Especialista→Lenda; progresso até o próximo nível
    - _Requirements: 9.1, 9.2, 9.4, 9.6, 9.7_
  - [x] 6.2 Escrever teste de propriedade para monotonicidade do Fan_Score em `fanScore.test.ts`
    - **Property 14: Fan_Score é monotônico não decrescente**
    - **Validates: Requirements 9.1, 9.2**
  - [x] 6.3 Escrever teste de propriedade para monotonicidade do nível em `fanScore.test.ts`
    - **Property 15: Nível_de_Torcedor é monotônico em relação ao Fan_Score**
    - **Validates: Requirements 9.4, 9.5**
  - [x] 6.4 Implementar `domain/achievements.ts` (`evaluateAchievements`)
    - Avaliação data-driven a partir do catálogo `AchievementDef[]`, idempotente (não duplica desbloqueios)
    - _Requirements: 10.1, 10.6_
  - [x] 6.5 Escrever teste de propriedade para idempotência de conquistas em `achievements.test.ts`
    - **Property 17: Desbloqueio de Conquista é idempotente**
    - **Validates: Requirements 10.6**
  - [x] 6.6 Implementar `domain/teamOfMonth.ts` (`buildTeamOfMonth`)
    - Seleção position-aware a partir das Notas_de_Jogo do período por formação; cada vaga preenchida pela posição exigida
    - _Requirements: 25.2, 25.3_
  - [x] 6.7 Escrever teste de propriedade para o Time do Mês em `teamOfMonth.test.ts`
    - **Property 16: Seleção do Time da Comunidade do Mês respeita a Posição**
    - **Validates: Requirements 25.2, 25.3**
  - [x] 6.8 Implementar `domain/predictions.ts` (`scorePrediction`)
    - Pontuação de palpites via `PredictionConfig` (placar exato, resultado correto, acerto de escalação por jogador)
    - _Requirements: 23.4, 23.5_
  - [x] 6.9 Escrever testes unitários para `predictions.ts`
    - Casos concretos: placar exato, apenas resultado, escalação parcial e palpite vazio
    - _Requirements: 23.4, 23.5_

- [x] 7. Checkpoint — camada domain
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Services de dados com injeção de dependências
  - [x] 8.1 Implementar `SquadService` (`getSquad`, CRUD, `importBatch`) com Cache e stale fallback
    - Injeção de `SupabaseClient` e `Cache` no construtor; `getStale` em erro de rede; TSDoc nos métodos públicos
    - _Requirements: 1.5, 1.8, 5.5, 28.5_
  - [x] 8.2 Escrever testes unitários do `SquadService`
    - Mock de `SupabaseClient`/`Cache`; stale fallback em falha de rede; validação do lote de importação
    - _Requirements: 1.8, 28.5_
  - [x] 8.3 Implementar `FixtureService` (`getFixtures`, `getFixture`, `importBatch`, `setLiberado`, `getLineup`, `saveLineup`)
    - Injeção de dependências; substituição da escalação anterior; alternância de `liberado`
    - _Requirements: 1.5, 28.6, 28.7, 28.8_
  - [x] 8.4 Escrever testes unitários do `FixtureService`
    - Validação do lote de partidas; substituição de escalação; alternância de `liberado`
    - _Requirements: 28.6, 28.7, 28.8_
  - [x] 8.5 Implementar `ScoreService` (`game_scores` + `permanent_scores`)
    - `submitScores` com `merge-duplicates` e contexto da partida; `savePermanentScore` tratando erro `23505` como mensagem de domínio
    - _Requirements: 20.10, 21.3, 21.4_
  - [x] 8.6 Escrever testes unitários do `ScoreService`
    - Erro `23505` → "Você já avaliou este jogador este ano"; falha ao salvar mantém `{ ok: false }` e não registra novo dado
    - _Requirements: 21.4_
  - [x] 8.7 Implementar `UserService` (`getUsers`, `setStatus`, `setRole`)
    - _Requirements: 28.1, 28.2, 28.11_
  - [x] 8.8 Escrever testes unitários do `UserService`
    - Atualização de status e papel com respostas mockadas do Supabase
    - _Requirements: 28.1, 28.2_
  - [x] 8.9 Implementar `UserProfileService` (perfil, estatísticas, atividade, linha do tempo, onboarding)
    - `getProfile`, `getRecentActivity`, `getTimeline`, `getFavoritePlayer`, `isOnboardingComplete`, `completeOnboarding`
    - _Requirements: 7.2, 8.1, 8.2, 8.6, 8.7_
  - [x] 8.10 Escrever testes unitários do `UserProfileService`
    - Agregação de estatísticas pessoais, jogador favorito e persistência de conclusão de onboarding
    - _Requirements: 7.2, 8.2_
  - [x] 8.11 Implementar `FanScoreService` (`getFanScore`, `awardAction`, `getConfig`)
    - Orquestra leitura/escrita e delega cálculo a `domain/fanScore.ts`; regras data-driven via `FanScoreConfig`
    - _Requirements: 9.2, 9.5, 9.7_
  - [x] 8.12 Escrever testes unitários do `FanScoreService`
    - Incremento por ação e promoção de nível com config mockada
    - _Requirements: 9.2, 9.5_
  - [x] 8.13 Implementar `AchievementService` (`getDefinitions`, `getUnlocked`, `evaluateAndPersist`)
    - Catálogo data-driven; delega avaliação a `domain/achievements.ts`; persistência idempotente
    - _Requirements: 10.1, 10.5, 10.6_
  - [x] 8.14 Escrever testes unitários do `AchievementService`
    - Persistência de desbloqueios e idempotência ao reavaliar conquistas já desbloqueadas
    - _Requirements: 10.5, 10.6_
  - [x] 8.15 Implementar `CraqueService` (`getVotes`, `vote`, `getManOfTheMatch`)
    - Voto distinto das notas 0–10; único voto vigente por usuário/partida via upsert `merge-duplicates`
    - _Requirements: 22.2, 22.3, 22.4_
  - [x] 8.16 Escrever testes unitários do `CraqueService`
    - Substituição do voto vigente (upsert) e apuração do mais votado
    - _Requirements: 22.3, 22.4_
  - [x] 8.17 Implementar `PredictionService` (`getPrediction`, `submit`, `scoreForFixture`)
    - Bloqueio de submissão/edição após o kickoff (`ts`); delega pontuação a `domain/predictions.ts`
    - _Requirements: 23.2, 23.3, 23.4_
  - [x] 8.18 Escrever testes unitários do `PredictionService`
    - Submissão bloqueada após kickoff; pontuação vs. resultado real
    - _Requirements: 23.2, 23.4_

- [x] 9. Autenticação e sessão
  - [x] 9.1 Implementar `LocalAuthService` (interface `AuthService` substituível)
    - `register` com validações e status `pending`; `login` com verificação de status; `logout`; `init` restaura sessão; hash SHA-256 via `crypto.subtle`; `onChange` para cabeçalho reativo
    - _Requirements: 5.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_
  - [x] 9.2 Escrever testes unitários do `AuthService`
    - Duplicidade de username/email; bloqueio de status `pending`/`rejected`; round-trip de sessão em `localStorage`
    - _Requirements: 6.2, 6.3, 6.5, 6.6, 6.8_

- [x] 10. Checkpoint — services e autenticação
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Contextos globais e hooks
  - [x] 11.1 Implementar `ServicesContext` e `useServices`
    - Instancia uma vez todos os Services com `SupabaseClient` e `Cache` injetados; permite mocks em teste sem alterar componentes
    - _Requirements: 1.5, 5.4_
  - [x] 11.2 Implementar `AuthContext` e `AuthProvider`
    - Expõe `session`, `isLoggedIn`, `isAdmin`, `login`, `logout`, `register`; mantém cabeçalho reativo via `onChange`; fonte dos guards
    - _Requirements: 6.10_
  - [x] 11.3 Implementar `ToastContext` e `ToastProvider`
    - `showToast(kind, messageKey, params?)`; fila empilhada verticalmente sem sobreposição; toast de sucesso parcial em lote
    - _Requirements: 31.1, 31.2, 31.3, 31.5_
  - [x] 11.4 Implementar o hook `useQuery`
    - Encapsula o padrão Service + Cache + estados de carregamento/erro/stale (sinaliza origem "stale" para aviso offline)
    - _Requirements: 1.8, 32.3_
  - [x] 11.5 Implementar hooks utilitários (`useCountdown`, `useDebounce`, `useMediaQuery`, `useReducedMotion`)
    - Base para contagem regressiva, debounce de busca/filtros, responsividade e `prefers-reduced-motion`
    - _Requirements: 11.7, 13.1, 30.7_

- [x] 12. Roteamento client-side (React Router) e guards
  - [x] 12.1 Implementar `router/guards.ts` com guards parametrizáveis
    - `requireAuth` (redireciona ao login), `requireAdmin` (redireciona a `/` com toast) e `requirePremium` (futuro, sem alterar componentes)
    - _Requirements: 5.2, 12.6, 12.7_
  - [x] 12.2 Implementar `ProtectedRoute` e a tabela de rotas `router/routes.tsx`
    - Rotas `/`, `/elenco`, `/jogador/:id`, `/comparar`, `/jogos`, `/jogo/:id`, `/rankings`, `/time-do-mes`, `/colecoes`, `/perfil(/:username)`, `/avaliar(/:fixtureId)`, `/onboarding`, `/admin`, `*`; `React.lazy` por rota; `NavLink` ativo; `popstate` nativo restaura conteúdo (incl. 404)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.8_
  - [x] 12.3 Escrever smoke tests do Router
    - Redirecionamento de guards (`requireAuth`/`requireAdmin`) e resolução de rota 404 por montagem esperada
    - _Requirements: 12.5, 12.6, 12.7_

- [x] 13. Temas, design tokens e i18n
  - [x] 13.1 Implementar `theme/tokens.ts` e `theme/tokens.css`
    - Design_Tokens tipados em TS + CSS Custom Properties; bloco `[data-theme]` por tema (`cruzeiro`, `dark`, `black-gold`, `retro-2003`, `libertadores`), sobrescrevendo apenas tokens; contraste WCAG AA
    - _Requirements: 4.1, 4.2, 4.3, 4.7_
  - [x] 13.2 Implementar `ThemeProvider` e `ThemeContext`
    - Aplica `data-theme` no `<html>`, persiste em `localStorage`, restaura preferência salva e usa `prefers-color-scheme: dark` como fallback inicial
    - _Requirements: 4.4, 4.5, 4.6_
  - [x] 13.3 Implementar `I18nProvider`, `useI18n` e o dicionário `i18n/pt-BR.ts`
    - `t(key, params?)` resolve `I18nKey`→pt-BR; define `lang="pt-BR"`; chave ausente → log de dev + fallback exibindo a própria chave
    - _Requirements: 2.1, 2.5, 2.6_
  - [x] 13.4 Escrever testes de componente para temas e i18n
    - Troca de tema por `data-theme` sem alterar componentes; fallback de chave ausente sem quebrar render
    - _Requirements: 2.6, 4.3_

- [x] 14. Biblioteca de componentes (temável via tokens, i18n)
  - [x] 14.1 Implementar controles (`Button`, `Badge`, `CompetitionBadge`, `StatCard`)
    - Props tipadas; textos via `I18nKey`; estilização exclusivamente por Design_Tokens; `StatCard` com count-up
    - _Requirements: 3.2, 3.3, 3.4, 30.2_
  - [x] 14.2 Implementar feedback (`Toast`, `Modal`, `Skeleton`, `EmptyState`, `Countdown`)
    - `Modal` com foco preso; `Countdown` troca para "O jogo está acontecendo agora!" ao zerar; `Skeleton`/`EmptyState` por seção
    - _Requirements: 11.8, 15.10, 33.7, 33.8_
  - [x] 14.3 Escrever testes de componente para feedback
    - `Modal` move foco ao abrir, prende o ciclo e retorna foco ao fechar; `Countdown` ao chegar a zero; `Skeleton`/`EmptyState` renderizam
    - _Requirements: 11.8, 33.7, 33.8_
  - [x] 14.4 Implementar cards (`PlayerCard`/FifaCard, `MatchCard`, `RankingCard`, `CollectionCard`, `AchievementCard`)
    - `PlayerCard` exibe rating 0–99 (`mapScoreToRating`), abreviação de posição, foto, nome, Nota_da_Temporada, votos, borda por Raridade_Carta e brilho só no hover; `onClick` navega ao perfil; `onShare` gera imagem
    - _Requirements: 3.2, 3.6, 15.3, 15.4, 15.9, 27.1_
  - [x] 14.5 Escrever testes de componente para os cards
    - `PlayerCard` usa apenas tokens (nenhuma cor literal) e resolve textos via i18n
    - _Requirements: 3.3, 3.4_
  - [x] 14.6 Implementar gráficos (`LineChart`, `Histogram`, `RadarChart`) com Recharts
    - Cores por token; `LineChart` de evolução com mensagem de dados insuficientes; `Histogram` de 10 faixas; `RadarChart` para 1 ou 2 jogadores
    - _Requirements: 29.1, 29.2, 29.3, 29.5, 29.8_
  - [x] 14.7 Implementar layout (`HeroSection`, `Navigation`, `PlayerHeader`, `Podium`)
    - `Navigation` com nome do usuário no cabeçalho, link ativo e menu colapsado no mobile; `Podium` com animação de entrada ao rolar
    - _Requirements: 3.2, 6.10, 16.2, 26.2_
  - [x] 14.8 Implementar `SearchPanel` e `StatisticsPanel`
    - `SearchPanel` abre com `/`, fecha com `Escape`, filtra em tempo real (máx. 5 por categoria) e mostra estado vazio; `StatisticsPanel` destaca o vencedor por métrica
    - _Requirements: 13.3, 13.6, 13.7, 13.8, 17.5_

- [x] 15. Checkpoint — biblioteca de componentes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Páginas como composições de rota
  - [x] 16.1 Implementar `HomePage` na hierarquia obrigatória
    - Hero → Última Partida → Jogador da Semana → Time da Comunidade do Mês → Melhores Jogadores (5) → Próxima Partida (`Countdown`) → Atividade da Comunidade → Jogadores em Alta → Últimas Avaliações → Navegação Rápida; Skeletons por seção; clique em jogador navega ao perfil
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13_
  - [x] 16.2 Implementar `ElencoPage`
    - Grid de `PlayerCard` com filtro de posição, ordenação e filtros combinados (via domínio, client-side); Skeletons; estado vazio
    - _Requirements: 14.1, 15.1, 15.5, 15.6, 15.10_
  - [x] 16.3 Implementar `PlayerProfilePage` (relatório de scouting)
    - `PlayerHeader`, `RadarChart`, resumo da temporada, forças/fraquezas, tendência, forma recente, `LineChart` de evolução, desempenho por competição, `Histogram` e seção de Nota_Permanente; 404 se `id` inexistente
    - _Requirements: 16.2, 16.3, 16.5, 16.8, 16.11, 16.14, 21.1, 21.2_
  - [x] 16.4 Implementar `CompararPage`
    - Seleção de dois jogadores; `RadarChart` sobreposto; `LineChart` comparativo; `StatisticsPanel` destacando o vencedor por métrica; "Dados insuficientes" por métrica ausente
    - _Requirements: 17.1, 17.2, 17.3, 17.5_
  - [x] 16.5 Implementar `JogosPage`
    - Abas "Próximos"/"Anteriores"; filtro de competição instantâneo preservado entre abas; `MatchCard`
    - _Requirements: 14.6, 19.1, 19.2_
  - [x] 16.6 Implementar `MatchDetailPage`
    - Placar/times/competição/estádio/status; escalação ordenada por nota; melhor/pior/média; participação; botão Avaliar/Editar; votação de `Craque_da_Partida`; painel de `Palpite`; 404 se inexistente
    - _Requirements: 19.3, 19.11, 22.1, 22.2, 22.4, 23.1, 23.2_
  - [x] 16.7 Implementar `RankingsPage`
    - Categorias com `Podium` e listas (≥10), filtro de competição (recalcula via domínio), busca por nome, "Partida Mais Bem Avaliada"; navegação para perfil/partida
    - _Requirements: 26.1, 26.2, 26.3_
  - [x] 16.8 Implementar `TimeDoMesPage`
    - Formação tática com `PlayerCard` por posição; seletor de mês/competição; estatísticas; compartilhável; "Dados insuficientes"
    - _Requirements: 25.1, 25.2, 25.3, 25.6, 27.2_
  - [x] 16.9 Implementar `ColecoesPage`
    - `CollectionCard` data-driven; progresso de exploração; destaque de coleções incompletas
    - _Requirements: 18.2, 18.3, 18.6_
  - [x] 16.10 Implementar `PerfilPage`
    - Identidade + "Membro Desde", estatísticas pessoais, Fan_Score + Nível + progresso, Conquistas (desbloqueadas/pendentes), Badges, Atividade Recente, Linha do Tempo; Skeletons por seção
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9.6_
  - [x] 16.11 Implementar `AvaliarPage`
    - Formulário de notas 0–10 (passo 0.5) com pré-preenchimento; submit com loading; toast + ganho de Fan_Score; erro mantém a interface aberta e reabilita o botão
    - _Requirements: 20.1, 20.2, 20.5, 20.7, 20.10, 9.2_
  - [x] 16.12 Implementar `AdminPage`
    - Gestão de usuários (aprovar/rejeitar/promover), elenco, partidas, escalações, flag `liberado`, importação em lote validada, `Modal` de confirmação, impedir auto-rebaixamento
    - _Requirements: 28.1, 28.2, 28.5, 28.6, 28.7, 28.8, 28.10, 28.11_
  - [x] 16.13 Implementar `OnboardingPage`
    - Sequência curta de boas-vindas (avaliação, Fan_Score, coleções); ação primária "Fazer minha primeira avaliação"; "Pular"; marca conclusão persistente
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 16.14 Implementar `NotFoundPage`
    - Variações "Página não encontrada" / "Jogador não encontrado" / "Partida não encontrada" com links de retorno
    - _Requirements: 12.5, 16.14, 19.11_

- [x] 17. Integração, PWA e remoção do legado
  - [x] 17.1 Implementar `main.tsx` e `App.tsx` (bootstrap)
    - Encadeia providers (Theme → i18n → Services → Auth → Router); `ThemeProvider` aplica tema salvo; `I18nProvider` define `lang="pt-BR"`; `AuthService.init()` restaura sessão; `RouterProvider` resolve a URL
    - _Requirements: 1.3, 2.5, 4.5, 6.8_
  - [x] 17.2 Configurar roteamento SPA no GitHub Pages
    - `404.html` redireciona ao `index.html` preservando o path; acesso direto a URLs profundas (`/jogador/:id`) resolve a rota no boot
    - _Requirements: 12.3, 12.4_
  - [x] 17.3 Implementar lembretes pré-jogo do PWA
    - Notification API + agendamento no service worker; ausência de permissão degrada silenciosamente
    - _Requirements: 34.4, 34.5, 34.6_
  - [x] 17.4 Remover código legado (Google Sheets e globais vanilla)
    - Excluir `js/sheets.js`, `google-apps-script/Code.gs` e os globais em `js/` (`api.js`, `app.js`, `auth.js`, `config.js`, `supabase.js`) e referências associadas
    - _Requirements: 1.11_
  - [x] 17.5 Passagem de acessibilidade e semântica
    - `aria-label` em botões de ícone, `alt` em imagens, `lang="pt-BR"`, contraste AA em todos os temas, HTML semântico e navegação por teclado com foco visível
    - _Requirements: 4.7, 33.5_
  - [x] 17.6 Escrever testes de integração dos fluxos principais
    - Fluxos de autenticação, avaliação (com ganho de Fan_Score) e navegação entre rotas com Services mockados via `ServicesContext`
    - _Requirements: 6.4, 20.10, 12.2_

- [x] 18. Checkpoint final
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido; o modelo NÃO deve implementar sub-tarefas com `*`.
- Cada tarefa referencia cláusulas de requisito específicas para rastreabilidade.
- Os checkpoints garantem validação incremental ao final de cada camada.
- Os testes de propriedade validam as 17 propriedades universais de corretude (P1–P17), cada uma em uma sub-tarefa própria, com no mínimo 100 iterações via fast-check, seguindo a tabela de cobertura do design.
- Os testes unitários e de componente validam exemplos concretos, condições de erro, wiring de Services (com dependências mockadas), renderização por tokens, resolução de i18n e acessibilidade.
- A camada `domain` importa apenas de `types`; toda gamificação delega o cálculo às funções puras, mantendo as regras data-driven e testáveis sem tocar na UI.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.3", "4.1", "4.4", "4.9", "5.1", "5.5", "5.8", "5.10", "6.1", "6.4", "6.6", "6.8"] },
    { "id": 3, "tasks": ["3.2", "3.4", "4.2", "4.5", "4.10", "5.2", "5.6", "5.9", "5.11", "6.2", "6.5", "6.7", "6.9", "8.1", "8.3", "8.5", "8.7", "8.9", "8.11", "8.13", "8.15", "8.17", "9.1"] },
    { "id": 4, "tasks": ["4.3", "4.6", "5.3", "5.7", "6.3", "8.2", "8.4", "8.6", "8.8", "8.10", "8.12", "8.14", "8.16", "8.18", "9.2"] },
    { "id": 5, "tasks": ["4.7", "5.4", "11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 6, "tasks": ["4.8", "12.1", "12.2", "13.1", "13.2", "13.3"] },
    { "id": 7, "tasks": ["12.3", "13.4", "14.1", "14.2", "14.4", "14.6", "14.7", "14.8"] },
    { "id": 8, "tasks": ["14.3", "14.5"] },
    { "id": 9, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "16.8", "16.9", "16.10", "16.11", "16.12", "16.13", "16.14"] },
    { "id": 10, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 11, "tasks": ["17.6"] }
  ]
}
```
