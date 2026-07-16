# Requirements Document

## Introduction

O JeanScore 2.0 transforma o JeanScore de um site de avaliação em um **produto digital de futebol premium** para a torcida do Cruzeiro. A plataforma não é um sistema administrativo nem um CRUD: é um produto construído para gerar emoção, pertencimento, exploração contínua e o hábito de voltar depois de cada partida. A cada rodada, o torcedor abre o JeanScore para dar sua nota aos jogadores, descobrir o Craque da Partida da comunidade, acompanhar o Time da Comunidade do Mês, ver seus ídolos evoluírem em cartas colecionáveis, comparar desempenhos como um olheiro e subir de nível como torcedor. A administração existe apenas para sustentar essa experiência — o futebol é sempre o protagonista.

Inspirado em Sofascore, FotMob, OneFootball, EA Sports FC Ultimate Team e Spotify, o JeanScore 2.0 é coerente com os documentos fundacionais `VISION.md` (visão de produto) e `DESIGN_SYSTEM.md` (linguagem visual). A camada de interface migra para **React + TypeScript + Vite** com arquitetura orientada a componentes reutilizáveis, enquanto a camada de domínio permanece agnóstica de framework. A plataforma mantém compatibilidade com hospedagem estática no GitHub Pages e usa o Supabase como backend REST.

Este documento preserva e refina as áreas já existentes (autenticação, homepage, elenco em cartas, perfil de jogador, jogos e detalhe de partida, avaliação por partida, rankings, feed da comunidade, busca global, filtros, painel admin, performance, responsividade e acessibilidade, notas permanentes, gráficos, animações, notificações e extensibilidade) e adiciona as novas áreas de produto: Perfil do Usuário, Fan Score, Níveis de Torcedor, Conquistas, Time da Comunidade do Mês, Comparação de Jogadores, Coleções Colecionáveis, Temas, arquitetura component-first, PWA e lembretes, Palpites, Craque da Partida, Cards Compartilháveis, i18n e Onboarding.

### Regra de Idioma do Produto (obrigatória em todo o documento)

- **Inglês (técnico):** código, variáveis, classes, componentes, funções, banco de dados, SQL, documentação de código, arquitetura, nomes de pastas, nomes de arquivos, comentários.
- **Português do Brasil (UI):** botões, menus, páginas, navegação, notificações, formulários, placeholders, mensagens, erros, sucessos, conquistas, badges, estatísticas, tooltips, gráficos, rótulos, estados vazios, mensagens de carregamento.
- **Nunca misturar** os dois na interface. Toda string de UI citada nos critérios de aceitação está em português do Brasil por definição; todo identificador técnico está em inglês.

---

## Glossary

### Termos gerais e de plataforma
- **Aplicação**: o sistema JeanScore 2.0 como um todo
- **Usuário**: qualquer pessoa que acessa a Aplicação
- **Usuário_Autenticado**: Usuário com sessão ativa e status `approved` no banco de dados
- **Admin**: Usuário_Autenticado com papel `admin` no banco de dados
- **Visitante**: Usuário não autenticado
- **Supabase**: serviço de banco de dados backend da Aplicação, acessado via REST
- **Cache**: armazenamento em memória com TTL configurável para evitar requisições duplicadas ao Supabase
- **Skeleton**: componente de carregamento que imita a forma do conteúdo antes de ser carregado
- **Router**: camada de navegação client-side (React Router ou equivalente) sem recarregamento de página
- **Service**: módulo TypeScript de camada de negócio que isola a lógica de acesso a dados
- **Domínio**: camada agnóstica de framework com a lógica pura (scoring, raridade, filtros, busca, serialização, ranking, estatísticas)
- **Componente**: unidade de interface reutilizável, temável via tokens e independente de página
- **Design_Token**: valor visual nomeado (cor, espaçamento, raio, sombra, duração) definido em `DESIGN_SYSTEM.md`, fonte única da verdade visual
- **Tema**: conjunto de valores de Design_Token aplicado via atributo raiz `data-theme`
- **Chave_i18n**: identificador técnico (em inglês) que mapeia para uma string de UI em português do Brasil

### Tabelas do Supabase
- **Tabela_users**: tabela `users` com colunas `username`, `email`, `pass_hash`, `role`, `status`, `created_at`
- **Tabela_squad**: tabela `squad` com dados dos jogadores do Cruzeiro
- **Tabela_fixtures**: tabela `fixtures` com dados das partidas
- **Tabela_escalacoes**: tabela `escalacoes` com jogadores convocados por partida
- **Tabela_game_scores**: tabela `game_scores` com avaliações por partida, jogador e usuário
- **Tabela_permanent_scores**: tabela `permanent_scores` com avaliações permanentes anuais

### Entidades de futebol
- **Jogador**: registro na Tabela_squad com campos `id`, `name`, `position`, `number`, `nationality`, `photo`
- **Partida**: registro na Tabela_fixtures com campos `id`, `home_team`, `away_team`, `home_score`, `away_score`, `fixture_date`, `ts`, `competition`, `stadium`, `status`, `liberado`
- **Avaliação**: nota numérica de 0 a 10 (incrementos de 0.5) submetida por um Usuário_Autenticado para um Jogador em uma Partida
- **Nota_de_Jogo**: média das Avaliações de todos os Usuário_Autenticados para um Jogador em uma Partida específica
- **Nota_Permanente**: avaliação anual de um Usuário_Autenticado para um Jogador (uma por ano por usuário)
- **Nota_da_Temporada**: média de todas as Notas_de_Jogo de um Jogador ao longo da temporada
- **Raridade_Carta**: classificação visual do Jogador: Bronze (nota < 6), Prata (6 ≤ nota < 7), Ouro (7 ≤ nota < 8), Lendária (nota ≥ 8)
- **Carta_FIFA**: componente visual de Jogador com estilo de Ultimate Team, exibindo Raridade_Carta, foto, posição e estatísticas
- **Escalação**: conjunto de Jogadores convocados para uma Partida específica
- **Competição**: uma das competições monitoradas: Série A (71), Copa do Brasil (73), Copa Libertadores (13), Campeonato Mineiro (629), Amistoso (999)
- **Posição**: uma de quatro categorias: Goleiro (`Goalkeeper`), Defensor (`Defender`), Meia (`Midfielder`), Atacante (`Attacker`)
- **Contagem_Regressiva**: contador em tempo real exibindo dias, horas, minutos e segundos até a próxima Partida

### Engajamento, comunidade e gamificação
- **Perfil_do_Usuário**: página pessoal do Usuário_Autenticado com sua identidade, estatísticas, atividade e recompensas
- **Fan_Score**: pontuação acumulada que recompensa a participação do Usuário_Autenticado na comunidade
- **Nível_de_Torcedor**: faixa alcançada conforme o Fan_Score, na ordem: Iniciante, Torcedor, Apaixonado, Especialista, Lenda
- **Conquista**: recompensa desbloqueável definida por dados/configuração (não por código), com título e descrição em português
- **Badge**: distintivo visual exibido no Perfil_do_Usuário representando um Nível_de_Torcedor ou uma Conquista
- **Feed_de_Atividade**: lista cronológica das últimas ações da comunidade (avaliações, novos usuários)
- **Time_da_Comunidade_do_Mês**: escalação montada automaticamente a partir das Avaliações da comunidade em um mês e competição
- **Comparação_de_Jogadores**: visualização lado a lado de dois Jogadores com métricas e gráficos
- **Coleção**: agrupamento temático de Carta_FIFA a ser explorado/completado (ex.: Coleção de Goleiros)
- **Craque_da_Partida**: Jogador mais votado pela comunidade como melhor de uma Partida, votação distinta das Avaliações 0–10
- **Palpite**: previsão pré-jogo de escalação e/ou placar submetida por um Usuário_Autenticado antes do início da Partida
- **PWA**: Progressive Web App instalável, com manifesto e service worker
- **Onboarding**: fluxo curto de boas-vindas para o primeiro acesso do Usuário_Autenticado

---

## Requirements

# Grupo A — Fundação Técnica e Arquitetura

### Requirement 1: Arquitetura e Infraestrutura Técnica

**User Story:** Como desenvolvedor, quero uma arquitetura React + TypeScript + Vite orientada a componentes, com a lógica de domínio isolada e agnóstica de framework, para que o produto seja tipado, manutenível, escalável e compatível com deploy estático no GitHub Pages.

#### Acceptance Criteria

1. THE Aplicação SHALL ser construída com React e TypeScript estrito (`strict: true`), usando Vite como bundler e gerando artefatos estáticos compatíveis com GitHub Pages.
2. THE Aplicação SHALL separar a camada de interface (React) da camada de Domínio, mantendo o Domínio (scoring, Raridade_Carta, filtros, busca, serialização, ranking, estatísticas) agnóstico de framework e sem qualquer dependência de React.
3. THE Aplicação SHALL organizar o código em camadas: `src/domain/` (lógica de negócio agnóstica), `src/services/` (acesso a dados), `src/components/` (biblioteca de componentes reutilizáveis), `src/pages/` (composições de rota), `src/router/` (navegação), `src/theme/` (Design_Tokens e Temas) e `src/types/` (interfaces e tipos TypeScript).
4. THE Aplicação SHALL usar o Router (React Router ou equivalente) com suporte a route guards para proteger rotas restritas.
5. WHEN um módulo Service é instanciado, THE Service SHALL receber suas dependências via injeção no construtor, sem imports acoplados a singletons globais.
6. THE Aplicação SHALL manter um módulo `SupabaseClient` que encapsula todas as chamadas REST ao Supabase, com tipos TypeScript para cada resposta.
7. THE Cache SHALL implementar TTL configurável por tipo de recurso, invalidação por chave e limpeza automática de entradas expiradas.
8. IF uma requisição ao Supabase falhar com erro de rede, THEN THE Service SHALL retornar o dado do Cache mais recente disponível (stale fallback), se existir.
9. WHEN o build de produção é executado, THE Aplicação SHALL bloquear a geração do bundle (build gate) caso a checagem de tipos (typecheck), o lint ou os testes automatizados falhem; o bundle SHALL ser gerado somente quando as três etapas passarem sem erros.
10. WHEN o Vite gera o bundle de produção, THE Aplicação SHALL produzir chunks separados por rota (code splitting por rota), permitindo carregamento sob demanda.
11. THE Aplicação SHALL remover todo código legado de integração com Google Sheets (`js/sheets.js`, `google-apps-script/Code.gs`) após a migração.
12. THE Aplicação SHALL definir interfaces TypeScript para todas as entidades de domínio: `Player`, `Fixture`, `GameScore`, `PermanentScore`, `User`, `Lineup`, `RankingEntry`, `UserProfile`, `Achievement`, `Collection`.


### Requirement 2: Regra de Duas Línguas e Estrutura de i18n

**User Story:** Como responsável pelo produto, quero que todo texto de interface fique em português do Brasil enquanto todo artefato técnico permanece em inglês, estruturado por chaves de i18n, para que a experiência pareça um aplicativo nativo brasileiro e a regra seja garantida pela própria arquitetura.

#### Acceptance Criteria

1. THE Aplicação SHALL exibir toda a interface voltada ao Usuário (botões, menus, páginas, navegação, notificações, formulários, placeholders, mensagens de erro e sucesso, conquistas, badges, estatísticas, tooltips, gráficos, rótulos, estados vazios e mensagens de carregamento) exclusivamente em português do Brasil.
2. THE Aplicação SHALL nomear todo artefato técnico (código, variáveis, classes, componentes, funções, banco de dados, SQL, documentação de código, arquitetura, pastas, arquivos e comentários) exclusivamente em inglês.
3. THE Aplicação SHALL armazenar todas as strings de UI como Chave_i18n em arquivos de tradução, sem texto em português hardcoded dentro dos Componentes.
4. WHEN um Componente precisa exibir texto ao Usuário, THE Componente SHALL resolver o texto por meio de uma Chave_i18n em vez de literais de string.
5. THE Aplicação SHALL definir o locale padrão como `pt-BR` e incluir o atributo `lang="pt-BR"` no elemento `<html>`.
6. IF uma Chave_i18n solicitada não possuir tradução correspondente, THEN THE Aplicação SHALL registrar o erro em log de desenvolvimento e exibir a própria chave como texto de fallback, sem quebrar a renderização.


### Requirement 3: Arquitetura Orientada a Componentes (Component-First)

**User Story:** Como desenvolvedor, quero que o produto seja construído a partir de uma biblioteca de componentes reutilizáveis em vez de páginas monolíticas, para que novas telas sejam composições rápidas e consistentes de peças já existentes.

#### Acceptance Criteria

1. THE Aplicação SHALL construir todas as páginas como composições de Componentes reutilizáveis da biblioteca de componentes, sem lógica de apresentação duplicada entre páginas.
2. THE Aplicação SHALL fornecer, no mínimo, os Componentes reutilizáveis: `PlayerCard` (Carta_FIFA), `MatchCard`, `CompetitionBadge`, `RankingCard`, `PlayerHeader`, `StatisticsPanel`, `Charts` (LineChart, Histogram, RadarChart), `HeroSection`, `Button` e `Navigation`.
3. THE Aplicação SHALL definir cada Componente com props tipadas em TypeScript, sendo os textos exibidos recebidos como Chave_i18n ou conteúdo em português.
4. THE Aplicação SHALL estilizar todos os Componentes exclusivamente por meio de Design_Tokens, sem valores visuais (cor, espaçamento, raio, sombra, duração) hardcoded fora do sistema de tokens.
5. WHERE um novo elemento visual é necessário em uma página, THE Aplicação SHALL adicioná-lo primeiro como Componente reutilizável na biblioteca antes de utilizá-lo na página (component-first).
6. THE Aplicação SHALL garantir que cada Componente seja independente de página, podendo ser reutilizado em múltiplos contextos sem alteração de código.


### Requirement 4: Temas e Design Tokens

**User Story:** Como Usuário, quero escolher entre múltiplos temas visuais e ter minha preferência lembrada, para que eu personalize a experiência sem que isso exija refatoração do produto.

#### Acceptance Criteria

1. THE Aplicação SHALL definir todos os valores visuais como Design_Tokens expostos como CSS Custom Properties e tipados em TypeScript (`src/theme/tokens.ts`), conforme `DESIGN_SYSTEM.md`.
2. THE Aplicação SHALL suportar os Temas: Cruzeiro (padrão), Modo Noturno, Black & Gold, Retrô 2003 e Libertadores.
3. WHEN um Tema é aplicado, THE Aplicação SHALL sobrescrever apenas os valores dos Design_Tokens via atributo raiz `data-theme`, sem alterar qualquer Componente.
4. WHEN um Usuário seleciona um Tema, THE Aplicação SHALL aplicar o Tema imediatamente e persistir a preferência no `localStorage`.
5. WHEN a Aplicação inicializa, THE Aplicação SHALL restaurar o Tema previamente escolhido pelo Usuário a partir do `localStorage`, se existir.
6. WHERE o Usuário não possui preferência de Tema salva e o sistema operacional indica `prefers-color-scheme: dark`, THE Aplicação SHALL adotar o Modo Noturno como Tema inicial.
7. THE Aplicação SHALL manter contraste mínimo WCAG 2.1 AA (4.5:1 para texto normal, 3:1 para texto grande e ícones essenciais) em todos os Temas.


### Requirement 5: Extensibilidade e Preparação para o Futuro

**User Story:** Como desenvolvedor, quero que a arquitetura suporte novas funcionalidades sem refatoração estrutural, para que o crescimento da plataforma seja sustentável.

#### Acceptance Criteria

1. THE Aplicação SHALL definir o módulo `AuthService` com interface que permita substituição futura do mecanismo de autenticação (ex.: migração para Supabase Auth) sem alteração nos Componentes de UI.
2. THE Router SHALL suportar route guards parametrizáveis, permitindo adicionar novas proteções (ex.: verificação de assinatura premium) sem reescrita do Router.
3. THE Aplicação SHALL definir interfaces TypeScript extensíveis para todas as entidades de domínio, com campos opcionais para extensões futuras (ex.: `achievements?: Achievement[]`, `favorited?: boolean`), garantindo consistência: se uma entidade central for extensível, todas devem ser extensíveis.
4. THE Aplicação SHALL isolar todas as chamadas ao Supabase em Services injetáveis, permitindo substituição por mocks em testes unitários sem modificar os Componentes de UI.
5. THE Aplicação SHALL documentar em comentários TSDoc todos os métodos públicos dos Services e funções utilitárias exportadas.


# Grupo B — Acesso, Identidade e Engajamento do Torcedor

### Requirement 6: Autenticação e Gerenciamento de Sessão

**User Story:** Como Usuário, quero me cadastrar, fazer login e manter minha sessão, para que eu possa avaliar jogadores e participar da comunidade.

#### Acceptance Criteria

1. WHEN um Visitante submete o formulário de cadastro com `username` (mínimo 3 caracteres), `email` válido e `password` (mínimo 6 caracteres), THE Aplicação SHALL criar um registro na Tabela_users com `status = 'pending'` e exibir mensagem de confirmação.
2. IF um Visitante tenta cadastrar um `username` já existente na Tabela_users, THEN THE Aplicação SHALL exibir a mensagem "Nome de usuário já existe" sem criar o registro.
3. IF um Visitante tenta cadastrar um `email` já existente na Tabela_users, THEN THE Aplicação SHALL exibir a mensagem "E-mail já cadastrado" sem criar o registro.
4. WHEN um Visitante submete credenciais válidas de login, THE Aplicação SHALL armazenar a sessão no `localStorage` e atualizar a interface para exibir o estado autenticado.
5. IF um Usuário tenta fazer login com `status = 'pending'`, THEN THE Aplicação SHALL exibir "Cadastro ainda não aprovado" e bloquear o acesso.
6. IF um Usuário tenta fazer login com `status = 'rejected'`, THEN THE Aplicação SHALL exibir "Cadastro recusado" e bloquear o acesso.
7. WHEN um Usuário_Autenticado seleciona "Sair", THE Aplicação SHALL remover a sessão do `localStorage` e redirecionar para a página inicial no estado de Visitante.
8. WHEN a Aplicação inicializa, THE Aplicação SHALL verificar a sessão armazenada no `localStorage` e restaurar o estado autenticado se a sessão for válida.
9. THE Aplicação SHALL armazenar senhas exclusivamente como hash SHA-256, nunca em texto plano.
10. WHILE um Usuário_Autenticado navega pela Aplicação, THE Aplicação SHALL manter o estado de autenticação visível no cabeçalho com o nome do usuário.


### Requirement 7: Onboarding do Novo Torcedor

**User Story:** Como novo Usuário_Autenticado, quero um fluxo curto de boas-vindas que me apresente o produto e me leve à minha primeira avaliação, para que eu comece a participar rapidamente.

#### Acceptance Criteria

1. WHEN um Usuário_Autenticado acessa a Aplicação pela primeira vez, THE Aplicação SHALL exibir o Onboarding com uma sequência curta de telas de boas-vindas apresentando avaliação de partidas, Fan_Score e coleções.
2. WHEN o Usuário_Autenticado conclui ou pula o Onboarding, THE Aplicação SHALL registrar a conclusão de forma persistente e não exibir o Onboarding novamente para o mesmo Usuário_Autenticado.
3. THE Onboarding SHALL apresentar ação primária "Fazer minha primeira avaliação" que direciona o Usuário_Autenticado à Partida liberada mais recente disponível para avaliação.
4. WHERE não existe Partida liberada para avaliação, THE Onboarding SHALL direcionar o Usuário_Autenticado ao Elenco com a mensagem "Explore o elenco enquanto o próximo jogo não chega".
5. THE Onboarding SHALL permitir que o Usuário_Autenticado pule o fluxo a qualquer momento por meio de ação "Pular".


### Requirement 8: Perfil do Usuário

**User Story:** Como Usuário_Autenticado, quero uma página de perfil pessoal com minha identidade, estatísticas e histórico de participação, para que eu acompanhe minha jornada como torcedor.

#### Acceptance Criteria

1. WHEN o Router navega para o Perfil_do_Usuário (`/perfil` ou `/perfil/:username`), THE Aplicação SHALL exibir a identidade do Usuário_Autenticado com nome de usuário e a informação "Membro Desde" (data de cadastro formatada).
2. THE Perfil_do_Usuário SHALL exibir as Estatísticas Pessoais: "Total de Avaliações", "Jogos Avaliados" e "Jogador Favorito" (Jogador mais avaliado pelo Usuário_Autenticado).
3. THE Perfil_do_Usuário SHALL exibir o Fan_Score atual e o Nível_de_Torcedor correspondente do Usuário_Autenticado.
4. THE Perfil_do_Usuário SHALL exibir as Conquistas do Usuário_Autenticado, diferenciando visualmente as desbloqueadas das pendentes.
5. THE Perfil_do_Usuário SHALL exibir os Badges da Comunidade conquistados pelo Usuário_Autenticado.
6. THE Perfil_do_Usuário SHALL exibir a "Atividade Recente" com as últimas avaliações submetidas pelo Usuário_Autenticado, cada uma com Jogador, Partida e nota.
7. THE Perfil_do_Usuário SHALL exibir a "Linha do Tempo de Atividade" ordenando cronologicamente os marcos do Usuário_Autenticado (primeira avaliação, conquistas desbloqueadas, mudanças de Nível_de_Torcedor).
8. WHEN um Usuário clica no "Jogador Favorito" ou em um Jogador da "Atividade Recente", THE Router SHALL navegar para a página de Perfil do Jogador correspondente.
9. WHEN o Perfil_do_Usuário carrega, THE Aplicação SHALL exibir Skeletons para cada seção durante o carregamento dos dados.
10. IF um Visitante tenta acessar o Perfil_do_Usuário sem sessão, THEN THE Aplicação SHALL redirecionar para o formulário de login com a mensagem "Você precisa estar logado para ver seu perfil."


### Requirement 9: Fan Score e Níveis de Torcedor

**User Story:** Como Usuário_Autenticado, quero acumular Fan Score conforme participo da comunidade e subir de nível de torcedor, para que minha dedicação seja reconhecida e recompensada.

#### Acceptance Criteria

1. THE Aplicação SHALL calcular o Fan_Score de cada Usuário_Autenticado a partir de ações de participação, incluindo: avaliar partidas, avaliar partidas consecutivas, retornar diariamente, participar de uma temporada inteira, avaliar todos os jogadores de uma Escalação e contribuir com a comunidade.
2. WHEN um Usuário_Autenticado realiza uma ação pontuável (ex.: submeter Avaliação de uma Partida), THE Aplicação SHALL incrementar o Fan_Score correspondente e exibir feedback visual do ganho.
3. THE Aplicação SHALL recompensar participação e presença, não competição entre Usuário_Autenticados, sem expor torcedores de forma negativa.
4. THE Aplicação SHALL mapear o Fan_Score para os Níveis de Torcedor, na ordem crescente: Iniciante, Torcedor, Apaixonado, Especialista, Lenda.
5. WHEN o Fan_Score de um Usuário_Autenticado atinge o limite de um novo Nível_de_Torcedor, THE Aplicação SHALL promover o Usuário_Autenticado ao novo nível e exibir notificação de reconhecimento em português.
6. THE Aplicação SHALL exibir o Fan_Score e o Nível_de_Torcedor no Perfil_do_Usuário, com indicação do progresso até o próximo nível.
7. THE Aplicação SHALL definir as regras de pontuação do Fan_Score de forma orientada a dados/configuração, permitindo ajustar valores sem alterar a lógica dos Componentes de UI.


### Requirement 10: Conquistas (Achievements)

**User Story:** Como Usuário_Autenticado, quero desbloquear conquistas conforme participo, para que eu tenha metas e reconhecimento pela minha jornada, e como desenvolvedor quero adicionar novas conquistas sem alterar o código existente.

#### Acceptance Criteria

1. THE Aplicação SHALL definir Conquistas de forma orientada a dados/configuração, de modo que novas Conquistas possam ser adicionadas sem modificar o código existente de avaliação de Conquistas.
2. THE Aplicação SHALL suportar, no mínimo, as Conquistas: "Primeira Avaliação", "10 Avaliações", "100 Avaliações", "Avaliou Todos os Jogos do Brasileirão", "Avaliou Todos os Jogos da Libertadores", "Especialista em Goleiros", "Especialista em Zagueiros", "Torcedor da Temporada" e "Veterano da Comunidade".
3. WHEN um Usuário_Autenticado satisfaz a condição de uma Conquista ainda não desbloqueada, THE Aplicação SHALL desbloquear a Conquista e exibir notificação de parabenização em português.
4. THE Aplicação SHALL exibir cada Conquista com título e descrição em português e estado desbloqueada ou pendente.
5. THE Aplicação SHALL persistir as Conquistas desbloqueadas de cada Usuário_Autenticado, mantendo-as entre sessões.
6. IF a condição de uma Conquista já desbloqueada é reavaliada, THEN THE Aplicação SHALL manter a Conquista desbloqueada sem duplicá-la nem gerar nova notificação (idempotência de desbloqueio).


# Grupo C — Descoberta e Navegação

### Requirement 11: Página Inicial (Homepage)

**User Story:** Como Visitante ou Usuário_Autenticado, quero uma página inicial premium que gere empolgação e me faça querer explorar, para que a cada rodada eu descubra de imediato as novidades do Cruzeiro sem parecer um painel administrativo.

#### Acceptance Criteria

1. WHEN a página inicial carrega, THE Aplicação SHALL organizar o conteúdo na hierarquia: Hero → Última Partida → Jogador da Semana → Time da Comunidade do Mês → Melhores Jogadores → Próxima Partida → Atividade da Comunidade → Jogadores em Alta → Últimas Avaliações → Navegação Rápida.
2. THE Hero SHALL destacar a identidade do Cruzeiro e criar empolgação visual, sem apresentar-se como um dashboard de dados.
3. WHEN a página inicial carrega, THE seção "Última Partida" SHALL exibir os dados da última Partida encerrada: times, placar, Competição, data e a Nota_de_Jogo média da comunidade.
4. WHEN a página inicial carrega, THE seção "Jogador da Semana" SHALL exibir o Jogador com a maior Nota_de_Jogo na Partida mais recente, com nome, foto, posição e nota.
5. WHEN a página inicial carrega, THE seção "Time da Comunidade do Mês" SHALL exibir uma prévia do Time_da_Comunidade_do_Mês vigente com acesso à visualização completa.
6. WHEN a página inicial carrega, THE seção "Melhores Jogadores" SHALL exibir os 5 Jogadores de maior Nota_da_Temporada, ordenados de forma decrescente.
7. WHEN a página inicial carrega e existe uma Partida futura agendada, THE seção "Próxima Partida" SHALL exibir uma Contagem_Regressiva em tempo real com dias, horas, minutos e segundos até o horário da próxima Partida.
8. WHEN a Contagem_Regressiva atinge zero, THE Aplicação SHALL substituir o contador pelo texto "O jogo está acontecendo agora!" sem necessidade de recarregamento.
9. WHEN a página inicial carrega, THE seção "Atividade da Comunidade" SHALL exibir as ações recentes da comunidade e THE seção "Jogadores em Alta" SHALL exibir os Jogadores com maior crescimento recente de nota.
10. WHEN a página inicial carrega, THE seção "Últimas Avaliações" SHALL exibir as Partidas avaliadas mais recentes com times, placar, Competição e Nota_de_Jogo média da Escalação.
11. THE seção "Navegação Rápida" SHALL oferecer atalhos para Elenco, Jogos, Rankings e Avaliar.
12. WHEN a página inicial carrega com dados em carregamento, THE Aplicação SHALL exibir Componentes Skeleton para cada seção até que os dados estejam disponíveis.
13. WHEN um Usuário clica em um Jogador em qualquer seção da página inicial, THE Router SHALL navegar para a página de Perfil do Jogador correspondente.


### Requirement 12: Navegação Client-Side (Router)

**User Story:** Como Usuário, quero navegação instantânea sem recarregamento e URLs que reflitam o conteúdo, para que eu use o botão "Voltar" e compartilhe links diretos.

#### Acceptance Criteria

1. THE Router SHALL mapear rotas para páginas: `/` (Homepage), `/elenco` (Elenco), `/jogador/:id` (Perfil do Jogador), `/comparar` (Comparação de Jogadores), `/jogos` (Jogos), `/jogo/:id` (Detalhe de Partida), `/rankings` (Rankings), `/time-do-mes` (Time da Comunidade do Mês), `/colecoes` (Coleções), `/perfil` (Perfil do Usuário), `/avaliar` (Avaliar) e `/admin` (Admin).
2. WHEN o Router navega para uma rota, THE Aplicação SHALL atualizar a URL do browser sem recarregamento de página.
3. WHEN um Usuário aciona o botão "Voltar" do browser, THE Router SHALL navegar para a rota anterior e restaurar o conteúdo correspondente, incluindo a página 404 caso ela fosse o conteúdo anterior.
4. WHEN um Visitante acessa diretamente uma URL com parâmetro (ex.: `/jogador/:id`), THE Router SHALL carregar a página correspondente com o parâmetro correto.
5. IF um Usuário acessa uma rota não mapeada, THEN THE Router SHALL exibir página 404 com mensagem "Página não encontrada" e link para a Homepage.
6. WHEN um Usuário tenta acessar a rota `/admin`, THE Router SHALL aplicar route guard e, caso o Usuário não seja Admin, redirecionar para `/` com toast "Acesso restrito a administradores."
7. WHEN um Visitante tenta acessar rotas que exigem autenticação (ex.: `/perfil`, `/avaliar`), THE Router SHALL aplicar route guard e redirecionar para o login com mensagem explicativa em português.
8. THE Router SHALL atualizar o link ativo no menu de navegação para refletir a rota atual.


### Requirement 13: Busca Global

**User Story:** Como Usuário, quero uma busca global que encontre jogadores, partidas e competições instantaneamente, para que eu acesse qualquer conteúdo sem navegar por menus.

#### Acceptance Criteria

1. WHEN um Usuário digita no campo de busca global, THE Aplicação SHALL exibir resultados filtrados em tempo real após cada caractere digitado, sem requisições adicionais ao Supabase.
2. THE Aplicação SHALL buscar simultaneamente em: nomes de Jogadores (Tabela_squad), adversários de Partidas (Tabela_fixtures) e nomes de Competições.
3. THE Aplicação SHALL exibir os resultados da busca separados por categoria (Jogadores, Partidas, Competições) com no máximo 5 resultados por categoria.
4. WHEN um Usuário clica em um resultado de Jogador na busca, THE Router SHALL navegar para a página de Perfil do Jogador.
5. WHEN um Usuário clica em um resultado de Partida na busca, THE Router SHALL navegar para a página de detalhe da Partida.
6. WHEN um Usuário pressiona a tecla `Escape`, THE Aplicação SHALL fechar o painel de resultados da busca.
7. WHERE o dispositivo suportar atalhos de teclado, THE Aplicação SHALL abrir o campo de busca global quando o Usuário pressionar `/` enquanto nenhum campo de formulário está em foco.
8. IF a busca não retornar resultados, THEN THE Aplicação SHALL exibir a mensagem "Nenhum resultado para '[termo]'" no painel de resultados.
9. THE Aplicação SHALL ignorar acentuação e diferença entre maiúsculas e minúsculas na comparação de termos de busca.


### Requirement 14: Filtros Avançados

**User Story:** Como Usuário, quero filtros combinados por posição, competição, intervalo de notas e número mínimo de votos, para que eu encontre exatamente os jogadores ou partidas que me interessam.

#### Acceptance Criteria

1. WHEN um Usuário aplica filtros na página de Elenco, THE Aplicação SHALL combinar todos os filtros ativos com lógica AND, atualizando os resultados em menos de 100ms sem nova requisição ao Supabase.
2. THE Aplicação SHALL disponibilizar filtro de intervalo de Nota_da_Temporada com controle de mínimo e máximo no intervalo [0, 10].
3. THE Aplicação SHALL disponibilizar filtro de mínimo de votos com opções: Sem filtro, ≥1, ≥3, ≥5, ≥10.
4. THE Aplicação SHALL disponibilizar filtro de Competição na página de Jogos, aplicando a seleção instantaneamente à lista de Partidas.
5. WHEN um Usuário seleciona "Limpar filtros", THE Aplicação SHALL redefinir todos os filtros para seus valores padrão e restaurar a lista completa.
6. THE Aplicação SHALL manter os filtros ativos ao navegar entre abas dentro da mesma página (ex.: "Próximos" e "Anteriores" na página de Jogos).
7. THE Aplicação SHALL exibir o número de resultados correspondentes aos filtros ativos em tempo real.


# Grupo D — Jogadores, Cartas e Coleções

### Requirement 15: Elenco e Cartas Colecionáveis

**User Story:** Como Usuário, quero visualizar o elenco completo do Cruzeiro em cartas colecionáveis premium, para que a experiência seja imersiva e reflita o desempenho real dos jogadores.

#### Acceptance Criteria

1. WHEN a página de Elenco carrega, THE Aplicação SHALL buscar todos os registros da Tabela_squad e exibi-los como Carta_FIFA com Raridade_Carta calculada pela Nota_da_Temporada atual.
2. THE Aplicação SHALL aplicar Raridade_Carta conforme: Nota_da_Temporada < 6 → Bronze; 6 ≤ nota < 7 → Prata; 7 ≤ nota < 8 → Ouro; nota ≥ 8 → Lendária (Preto e Dourado).
3. THE Carta_FIFA SHALL exibir: nota numérica no canto superior esquerdo (escala 0–99 mapeada de 0–10), abreviação de Posição, foto do Jogador, nome, Nota_da_Temporada e contagem de votos.
4. WHEN um Usuário passa o cursor sobre uma Carta_FIFA em desktop, THE Carta_FIFA SHALL executar animação de gradiente de brilho exclusivamente em resposta ao evento de hover (nunca automaticamente), com duração máxima de 300ms.
5. WHEN um Usuário seleciona um filtro de Posição (Todos, Goleiros, Defensores, Meias, Atacantes), THE Aplicação SHALL filtrar as Carta_FIFA exibidas para mostrar somente Jogadores da Posição selecionada, sem recarregar dados do Supabase.
6. WHEN um Usuário seleciona ordenação "Por nota", THE Aplicação SHALL reordenar as Carta_FIFA em ordem decrescente de Nota_da_Temporada, com Jogadores sem nota exibidos ao final.
7. WHEN um Usuário seleciona ordenação "Por posição", THE Aplicação SHALL reordenar as Carta_FIFA na sequência Goleiros → Defensores → Meias → Atacantes, com ordem alfabética dentro de cada grupo.
8. WHEN a página de Elenco carrega, THE Aplicação SHALL exibir Skeletons no formato de Carta_FIFA durante o carregamento dos dados do Supabase.
9. WHEN um Usuário clica em uma Carta_FIFA, THE Router SHALL navegar para a página de Perfil do Jogador correspondente.
10. IF a Tabela_squad retornar lista vazia ou erro de rede, THEN THE Aplicação SHALL exibir estado vazio com mensagem "Não foi possível carregar o elenco" e botão "Tentar novamente".


### Requirement 16: Perfil do Jogador (Relatório de Scouting)

**User Story:** Como Usuário, quero uma página de jogador com a profundidade de um relatório profissional de olheiro, com gráficos e análises, para que eu compreenda a evolução e o perfil de desempenho do jogador ao longo da temporada.

#### Acceptance Criteria

1. WHEN o Router navega para a URL de perfil de um Jogador (`/jogador/:id`), THE Aplicação SHALL carregar os dados do Jogador da Tabela_squad combinados com as Notas_de_Jogo da Tabela_game_scores; o requisito é considerado satisfeito quando os dados estão carregados, independentemente do estado visual.
2. WHEN os dados do Jogador estão carregados, THE `PlayerHeader` SHALL exibir: foto do Jogador em alta resolução, nome completo, número da camisa, Posição traduzida, nacionalidade, Raridade_Carta atual e Nota_da_Temporada.
3. THE Aplicação SHALL exibir um RadarChart com o perfil de atributos de desempenho do Jogador.
4. THE Aplicação SHALL exibir um "Resumo da Temporada" com Nota_da_Temporada, número de Partidas avaliadas e total de votos recebidos.
5. THE Aplicação SHALL exibir as "Forças" e "Fraquezas" do Jogador derivadas de suas Notas_de_Jogo e Competições.
6. THE Aplicação SHALL exibir a "Tendência da Comunidade" indicando se o Jogador está em alta ou em baixa nas últimas Partidas avaliadas.
7. THE Aplicação SHALL exibir a "Forma Recente" com as últimas 5 Partidas do Jogador, cada uma com adversário, Competição, data, Nota_de_Jogo e número de votos.
8. THE Aplicação SHALL exibir uma "Linha do Tempo de Desempenho" (LineChart) com as Notas_de_Jogo do Jogador ao longo das Partidas da temporada, ordenadas cronologicamente.
9. THE Aplicação SHALL exibir o "Desempenho por Competição" com a Nota_de_Jogo média do Jogador separada por Competição em que participou.
10. THE Aplicação SHALL exibir os "Destaques Visuais": melhor e pior Nota_de_Jogo da temporada, cada uma com a Partida correspondente (adversário, data), e o ranking atual do Jogador na temporada (posição entre Jogadores com ao menos 3 votos).
11. THE Aplicação SHALL exibir a distribuição de notas do Jogador como Histogram com 10 faixas de 1 ponto (0–1, 1–2, … 9–10), mostrando a frequência absoluta de votos em cada faixa.
12. WHEN a página de perfil carrega, THE Aplicação SHALL exibir Skeletons para cada seção de dados durante o carregamento.
13. WHEN um Usuário clica em uma Partida na "Forma Recente", THE Router SHALL navegar para a página de detalhe daquela Partida.
14. IF o `id` do Jogador não existir na Tabela_squad, THEN THE Aplicação SHALL exibir página de erro 404 com mensagem "Jogador não encontrado" e link para voltar ao Elenco.


### Requirement 17: Comparação de Jogadores

**User Story:** Como Usuário, quero comparar dois jogadores lado a lado, para que eu avalie qual está rendendo mais como um verdadeiro olheiro.

#### Acceptance Criteria

1. WHEN o Router navega para a Comparação_de_Jogadores (`/comparar`), THE Aplicação SHALL permitir que o Usuário selecione dois Jogadores para comparar.
2. WHEN dois Jogadores estão selecionados, THE Aplicação SHALL exibir lado a lado, para cada Jogador: Nota_da_Temporada média, contagem de votos, forma recente, melhor Partida, pior Partida e desempenho por Competição.
3. THE Aplicação SHALL exibir um RadarChart sobrepondo os atributos dos dois Jogadores para comparação visual direta.
4. THE Aplicação SHALL exibir um LineChart comparando a evolução de desempenho dos dois Jogadores ao longo da temporada.
5. THE Aplicação SHALL exibir um painel de Estatísticas comparativo destacando, para cada métrica, qual Jogador possui o valor superior.
6. IF um dos Jogadores selecionados não possuir dados suficientes para uma métrica, THEN THE Aplicação SHALL exibir "Dados insuficientes" para aquela métrica sem interromper a comparação das demais.
7. WHEN o Usuário troca um dos Jogadores selecionados, THE Aplicação SHALL recalcular e atualizar toda a comparação sem recarregar a página.
8. WHEN a Comparação_de_Jogadores carrega dados, THE Aplicação SHALL exibir Skeletons nas seções durante o carregamento.


### Requirement 18: Coleções Colecionáveis

**User Story:** Como Usuário, quero coleções temáticas de cartas para descobrir e completar, para que eu explore o elenco de forma lúdica e engajante.

#### Acceptance Criteria

1. WHEN o Router navega para as Coleções (`/colecoes`), THE Aplicação SHALL exibir as Coleções disponíveis, no mínimo: "Coleção de Goleiros", "Coleção de Defensores", "Coleção Lendária", "Coleção da Temporada" e "Coleção Libertadores".
2. THE Aplicação SHALL exibir cada Coleção com os Jogadores que a compõem representados como Carta_FIFA, indicando o progresso de exploração da Coleção.
3. THE Aplicação SHALL definir as Coleções de forma orientada a dados/configuração, permitindo adicionar novas Coleções sem alterar o código existente de exibição de Coleções.
4. WHEN um Usuário clica em uma Carta_FIFA dentro de uma Coleção, THE Router SHALL navegar para a página de Perfil do Jogador correspondente.
5. WHEN uma Coleção carrega, THE Aplicação SHALL exibir Skeletons no formato de Carta_FIFA durante o carregamento.
6. THE Aplicação SHALL incentivar a exploração destacando visualmente Coleções ainda não totalmente exploradas pelo Usuário.


# Grupo E — Partidas, Avaliação e Palpites

### Requirement 19: Jogos e Detalhe de Partida

**User Story:** Como Usuário, quero uma página de detalhe completa para cada partida com placar, escalação e estatísticas de avaliação da comunidade, para que eu explore o desempenho coletivo do time em cada jogo.

#### Acceptance Criteria

1. WHEN a página de Jogos carrega, THE Aplicação SHALL buscar todas as Partidas da Tabela_fixtures e exibi-las, separadas nas abas "Próximos" e "Anteriores".
2. WHEN um Usuário filtra por Competição na página de Jogos, THE Aplicação SHALL filtrar a lista de Partidas para exibir apenas as Partidas da Competição selecionada, sem nova requisição ao Supabase.
3. WHEN o Router navega para a URL de detalhe de uma Partida (`/jogo/:id`), THE Aplicação SHALL exibir: placar (ou "vs" se não encerrada), nome dos times, logo dos times, Competição, data, estádio e status da Partida.
4. WHEN a página de detalhe de Partida carrega e a Escalação está cadastrada, THE Aplicação SHALL buscar as Notas_de_Jogo da Tabela_game_scores e exibir cada Jogador da Escalação com: foto, nome, Posição, Nota_de_Jogo (média) e número de votos.
5. THE Aplicação SHALL ordenar os Jogadores na página de detalhe de Partida por Nota_de_Jogo decrescente, com Jogadores sem votos exibidos ao final.
6. THE Aplicação SHALL exibir na página de detalhe de Partida: Jogador com maior Nota_de_Jogo, Jogador com menor Nota_de_Jogo e Nota_de_Jogo média de toda a Escalação.
7. THE Aplicação SHALL exibir na página de detalhe de Partida: total de participantes que avaliaram a Partida e percentual de participação (usuários que avaliaram / total de Usuário_Autenticados aprovados).
8. IF a Partida está com `liberado = true` e o Usuário_Autenticado ainda não avaliou, THEN THE Aplicação SHALL exibir botão "Avaliar jogadores" na página de detalhe.
9. IF a Partida está com `liberado = true` e o Usuário_Autenticado já avaliou, THEN THE Aplicação SHALL exibir botão "Editar minhas notas" na página de detalhe.
10. WHEN a página de detalhe de Partida carrega, THE Aplicação SHALL exibir Skeletons para a Escalação durante o carregamento.
11. IF o `id` da Partida não existir na Tabela_fixtures, THEN THE Aplicação SHALL exibir página de erro 404 com mensagem "Partida não encontrada" e link para voltar à lista de Jogos.


### Requirement 20: Sistema de Avaliação por Partida

**User Story:** Como Usuário_Autenticado, quero avaliar os jogadores de uma partida com nota de 0 a 10, para que minhas avaliações contribuam para as estatísticas da comunidade.

#### Acceptance Criteria

1. WHEN um Usuário_Autenticado acessa a interface de avaliação de uma Partida liberada, THE Aplicação SHALL exibir todos os Jogadores da Escalação com campo de entrada de nota individual.
2. THE Aplicação SHALL aceitar notas no intervalo [0, 10] com incrementos de 0.5, normalizando valores fora do intervalo para o limite mais próximo (0 ou 10).
3. WHEN um Usuário_Autenticado submete notas para uma Partida, THE Aplicação SHALL salvar cada Avaliação na Tabela_game_scores via Supabase usando `resolution=merge-duplicates` para permitir edição.
4. WHEN o Usuário_Autenticado retorna à interface de avaliação de uma Partida já avaliada, THE Aplicação SHALL pré-preencher os campos com as notas anteriores do Usuário_Autenticado.
5. IF uma requisição de salvamento ao Supabase falhar, THEN THE Aplicação SHALL exibir mensagem de erro "Erro ao salvar. Tente novamente." sem fechar a interface de avaliação.
6. WHEN todas as notas são salvas com sucesso, THE Aplicação SHALL exibir toast de confirmação com o número de notas salvas, atualizar os dados de Nota_de_Jogo na interface e computar o ganho de Fan_Score correspondente.
7. WHILE a submissão das notas está em progresso, THE Aplicação SHALL desabilitar o botão de salvar e exibir indicador de carregamento.
8. IF um Visitante tenta acessar a interface de avaliação, THEN THE Aplicação SHALL redirecionar para o formulário de login com mensagem "Você precisa estar logado para avaliar."
9. IF a Partida não está marcada como `liberado = true`, THEN THE Aplicação SHALL ocultar a interface de avaliação e exibir mensagem explicativa informando que a partida ainda não está disponível para avaliação.
10. WHEN um Usuário_Autenticado avalia, THE Aplicação SHALL registrar `home_team`, `away_team` e `fixture_date` junto com a Avaliação na Tabela_game_scores para rastreabilidade.


### Requirement 21: Nota Permanente Anual

**User Story:** Como Usuário_Autenticado, quero dar uma nota anual consolidada para cada jogador, para que minha avaliação da temporada fique registrada independentemente das notas por partida.

#### Acceptance Criteria

1. WHEN um Usuário_Autenticado acessa a página de Perfil de um Jogador, THE Aplicação SHALL exibir a seção de Nota_Permanente com o formulário de avaliação anual.
2. THE Aplicação SHALL aceitar Nota_Permanente no intervalo [0, 10] com incrementos de 0.5.
3. WHEN um Usuário_Autenticado submete uma Nota_Permanente para um Jogador em um determinado ano pela primeira vez, THE Aplicação SHALL registrar a nota na Tabela_permanent_scores.
4. IF um Usuário_Autenticado tenta submeter uma segunda Nota_Permanente para o mesmo Jogador no mesmo ano, THEN THE Aplicação SHALL exibir a mensagem "Você já avaliou este jogador este ano" e bloquear o novo registro.
5. THE Aplicação SHALL exibir a Nota_Permanente média atual do Jogador (média de todas as notas permanentes do ano) na página de Perfil do Jogador.
6. WHEN um Usuário_Autenticado já avaliou permanentemente um Jogador, THE Aplicação SHALL exibir a nota que o Usuário_Autenticado deu ao lado da média geral, identificada como "Sua nota."


### Requirement 22: Craque da Partida

**User Story:** Como Usuário_Autenticado, quero votar no craque de cada partida, para que a comunidade eleja seu melhor jogador do jogo, de forma distinta das notas de 0 a 10.

#### Acceptance Criteria

1. WHERE uma Partida está com `liberado = true`, THE Aplicação SHALL exibir a votação de Craque_da_Partida na página de detalhe da Partida, distinta das Avaliações de 0 a 10.
2. WHEN um Usuário_Autenticado vota em um Jogador da Escalação como Craque_da_Partida, THE Aplicação SHALL registrar o voto e permitir apenas um voto de Craque_da_Partida por Usuário_Autenticado por Partida.
3. WHEN o Usuário_Autenticado já votou no Craque_da_Partida e vota novamente, THE Aplicação SHALL substituir o voto anterior pelo novo voto (um único voto vigente por Partida).
4. THE Aplicação SHALL exibir o Craque_da_Partida vigente como o Jogador mais votado, com a contagem de votos da comunidade.
5. IF um Visitante tenta votar no Craque_da_Partida, THEN THE Aplicação SHALL redirecionar para o login com mensagem "Você precisa estar logado para votar."
6. WHEN um Usuário_Autenticado vota no Craque_da_Partida, THE Aplicação SHALL computar o ganho de Fan_Score correspondente.


### Requirement 23: Palpites Pré-Jogo

**User Story:** Como Usuário_Autenticado, quero fazer palpites de escalação e/ou placar antes do jogo, para que eu participe da antecipação da partida e ganhe Fan Score conforme meus acertos.

#### Acceptance Criteria

1. WHERE uma Partida ainda não iniciou, THE Aplicação SHALL permitir que o Usuário_Autenticado submeta um Palpite de escalação e/ou de placar para essa Partida.
2. WHEN o horário de início da Partida é atingido, THE Aplicação SHALL bloquear a submissão e a edição de Palpites para essa Partida.
3. WHEN o Usuário_Autenticado submete um Palpite antes do bloqueio, THE Aplicação SHALL persistir o Palpite e permitir sua edição enquanto a Partida não iniciar.
4. WHEN a Partida é encerrada com placar oficial registrado, THE Aplicação SHALL pontuar os Palpites comparando-os ao resultado real e exibir o resultado do Palpite ao Usuário_Autenticado.
5. WHEN um Palpite é pontuado, THE Aplicação SHALL computar o ganho de Fan_Score correspondente aos acertos.
6. IF um Visitante tenta submeter um Palpite, THEN THE Aplicação SHALL redirecionar para o login com mensagem "Você precisa estar logado para palpitar."


# Grupo F — Comunidade, Rankings e Compartilhamento

### Requirement 24: Feed de Atividade da Comunidade

**User Story:** Como Usuário, quero ver um feed de atividade recente da comunidade, para que eu me sinta parte de um grupo de torcedores ativos e saiba quem está avaliando.

#### Acceptance Criteria

1. WHEN a seção de comunidade carrega, THE Aplicação SHALL exibir as avaliações mais recentes da Tabela_game_scores ordenadas por `created_at` decrescente (até 20 registros), com: nome do Usuário_Autenticado avaliador, nome do Jogador avaliado, nota e Partida correspondente; IF houver menos de 20 avaliações registradas, THEN THE Aplicação SHALL exibir as disponíveis sem preencher entradas fictícias.
2. THE Aplicação SHALL exibir a lista dos 5 Usuário_Autenticados com mais avaliações registradas na Tabela_game_scores na temporada corrente.
3. THE Aplicação SHALL exibir o total global de avaliações, o total de Partidas avaliadas e o total de Usuário_Autenticados que já submeteram ao menos uma avaliação.
4. THE Aplicação SHALL exibir os 3 Jogadores com maior crescimento de nota média comparando as últimas 3 Partidas avaliadas com a média geral da temporada, identificados como "Em alta".
5. THE Aplicação SHALL exibir os 3 Jogadores com maior queda de nota média comparando as últimas 3 Partidas avaliadas com a média geral da temporada, identificados como "Em baixa".
6. WHEN um Usuário clica em um Jogador no feed de atividade, THE Router SHALL navegar para a página de Perfil do Jogador correspondente.
7. WHEN a seção de comunidade carrega, THE Aplicação SHALL exibir Skeletons para o feed durante o carregamento dos dados.


### Requirement 25: Time da Comunidade do Mês

**User Story:** Como Usuário, quero ver o time do mês montado a partir das avaliações da comunidade, para que eu descubra a seleção coletiva dos melhores jogadores em campo.

#### Acceptance Criteria

1. WHEN o Router navega para o Time_da_Comunidade_do_Mês (`/time-do-mes`), THE Aplicação SHALL montar automaticamente a escalação a partir das Notas_de_Jogo da comunidade no mês e Competição selecionados.
2. THE Aplicação SHALL exibir o Time_da_Comunidade_do_Mês em uma formação tática, posicionando os Jogadores conforme suas Posições.
3. THE Aplicação SHALL selecionar, para cada Posição da formação, os Jogadores com maior Nota_de_Jogo média no período, exibindo-os como Carta_FIFA.
4. THE Aplicação SHALL exibir, para o Time_da_Comunidade_do_Mês: mês, Competição, nota média do time e estatísticas da seleção.
5. WHEN o Usuário altera o mês ou a Competição, THE Aplicação SHALL recalcular e atualizar o Time_da_Comunidade_do_Mês sem recarregar a página.
6. IF não houver Avaliações suficientes para compor uma formação completa no período, THEN THE Aplicação SHALL exibir a mensagem "Dados insuficientes para montar o time deste período".
7. WHEN um Usuário clica em uma Carta_FIFA do Time_da_Comunidade_do_Mês, THE Router SHALL navegar para a página de Perfil do Jogador correspondente.
8. WHEN o Time_da_Comunidade_do_Mês carrega, THE Aplicação SHALL exibir Skeletons durante o carregamento dos dados.


### Requirement 26: Rankings Expandidos

**User Story:** Como Usuário, quero rankings detalhados com múltiplas categorias e filtros, para que eu descubra os melhores jogadores por diferentes critérios de desempenho.

#### Acceptance Criteria

1. WHEN a página de Rankings carrega, THE Aplicação SHALL calcular e exibir as categorias: Melhor Média Geral, Mais Consistente (menor desvio padrão, mínimo 3 partidas), Mais Votos, Melhor Goleiro, Melhor Defensor, Melhor Meia e Melhor Atacante, a partir das Notas_de_Jogo da Tabela_game_scores.
2. THE Aplicação SHALL exibir o pódio (1º, 2º e 3º lugar) de cada categoria com animação de entrada ao rolar a página até a seção correspondente.
3. WHEN um Usuário seleciona um filtro de Competição na página de Rankings, THE Aplicação SHALL recalcular todos os rankings considerando somente as Notas_de_Jogo de Partidas da Competição selecionada, sem nova requisição ao Supabase.
4. THE Aplicação SHALL incluir a categoria "Partida Mais Bem Avaliada" exibindo as 5 Partidas com maior Nota_de_Jogo média da Escalação.
5. THE Aplicação SHALL exibir no mínimo os 10 primeiros colocados em cada categoria de ranking de Jogadores.
6. WHEN um Usuário clica em um Jogador em qualquer lista de ranking, THE Router SHALL navegar para a página de Perfil do Jogador correspondente.
7. WHEN um Usuário clica em uma Partida na categoria "Partida Mais Bem Avaliada", THE Router SHALL navegar para a página de detalhe daquela Partida.
8. THE Aplicação SHALL exibir Skeletons para cada categoria de ranking durante o carregamento.
9. THE Aplicação SHALL incluir campo de busca na página de Rankings para filtrar Jogadores por nome em tempo real, sem requerer submissão de formulário.
10. THE Aplicação SHALL considerar apenas Jogadores com ao menos 1 voto para os rankings de Melhor por Posição; para a categoria Mais Consistente, THE Aplicação SHALL exigir ao menos 3 Partidas avaliadas.


### Requirement 27: Cards Compartilháveis

**User Story:** Como Usuário, quero gerar imagens compartilháveis das cartas de jogadores e do Time da Comunidade do Mês, para que eu divulgue conteúdo do JeanScore nas redes sociais.

#### Acceptance Criteria

1. WHEN um Usuário aciona "Compartilhar" em uma Carta_FIFA, THE Aplicação SHALL gerar uma imagem compartilhável da carta do Jogador com sua identidade visual e estatísticas.
2. WHEN um Usuário aciona "Compartilhar" no Time_da_Comunidade_do_Mês, THE Aplicação SHALL gerar uma imagem compartilhável da formação com os Jogadores selecionados.
3. THE Aplicação SHALL permitir que o Usuário baixe a imagem gerada e/ou use a API nativa de compartilhamento do dispositivo, quando disponível.
4. THE imagem compartilhável SHALL conter identificação da marca JeanScore e exibir todo texto em português do Brasil.
5. IF a geração da imagem falhar, THEN THE Aplicação SHALL exibir toast de erro "Não foi possível gerar a imagem. Tente novamente." sem interromper a navegação.


# Grupo G — Administração (secundária à experiência)

### Requirement 28: Painel Admin Aprimorado

**User Story:** Como Admin, quero um painel administrativo com operações em lote, validações robustas, confirmações antes de ações destrutivas e logs de auditoria, para que eu gerencie a plataforma com segurança e eficiência, sustentando a experiência do torcedor.

#### Acceptance Criteria

1. WHEN o Admin acessa o painel de gerenciamento de usuários, THE Aplicação SHALL exibir todos os usuários da Tabela_users com status, data de cadastro e ações disponíveis (Aprovar, Rejeitar, Promover a Admin, Remover Admin).
2. WHEN o Admin aprova ou rejeita um cadastro pendente, THE Aplicação SHALL atualizar o `status` do registro na Tabela_users imediatamente e exibir feedback de confirmação.
3. WHEN o Admin tenta excluir um Jogador do elenco, THE Aplicação SHALL exibir modal de confirmação com nome do Jogador antes de executar a operação na Tabela_squad.
4. WHEN o Admin tenta excluir uma Partida, THE Aplicação SHALL exibir modal de confirmação com os nomes dos times e a data antes de executar a operação na Tabela_fixtures.
5. THE Aplicação SHALL permitir que o Admin adicione múltiplos Jogadores ao elenco em uma operação de importação em lote via JSON; THE Aplicação SHALL validar os campos obrigatórios (`id`, `name`, `position`) antes de iniciar a importação e rejeitar o lote se a validação falhar.
6. THE Aplicação SHALL permitir que o Admin importe múltiplas Partidas em lote via JSON; THE Aplicação SHALL validar os campos obrigatórios (`home_team`, `away_team`, `fixture_date`, `competition`) antes de iniciar a importação e rejeitar o lote se a validação falhar.
7. WHEN o Admin salva a Escalação de uma Partida, THE Aplicação SHALL persistir os `player_id` selecionados na Tabela_escalacoes, substituindo a Escalação anterior.
8. WHEN o Admin ativa ou desativa a flag `liberado` de uma Partida, THE Aplicação SHALL atualizar o campo `liberado` na Tabela_fixtures imediatamente e exibir confirmação de sucesso.
9. THE Aplicação SHALL exibir log de auditoria das últimas 50 operações administrativas (aprovações, exclusões, importações) com data, usuário executor e descrição da ação.
10. IF um campo obrigatório do formulário de cadastro manual de Jogador ou Partida estiver vazio ao submeter, THEN THE Aplicação SHALL destacar o campo com borda vermelha e exibir mensagem de validação específica sem fechar o formulário.
11. THE Aplicação SHALL impedir que o Admin rebaixe a si próprio (remoção do papel `admin` do próprio usuário logado).


# Grupo H — Experiência, Performance e Qualidade

### Requirement 29: Gráficos e Visualização de Dados

**User Story:** Como Usuário, quero gráficos interativos que visualizem a evolução, distribuição e comparação das notas dos jogadores, para que eu compreenda tendências de desempenho rapidamente.

#### Acceptance Criteria

1. THE Aplicação SHALL renderizar o LineChart de evolução de desempenho usando uma biblioteca de gráficos leve compatível com React e ES modules, com eixo X representando as Partidas em ordem cronológica e eixo Y a Nota_de_Jogo de 0 a 10.
2. THE Aplicação SHALL renderizar o Histogram de distribuição de notas como gráfico de barras verticais com 10 faixas de 1 ponto e eixo Y com a frequência absoluta de votos.
3. THE Aplicação SHALL renderizar o RadarChart de atributos de Jogador, suportando a sobreposição de dois Jogadores na Comparação_de_Jogadores.
4. WHEN um Usuário passa o cursor sobre um ponto no LineChart, THE Aplicação SHALL exibir tooltip com adversário, data e Nota_de_Jogo da Partida correspondente somente quando as três informações estiverem disponíveis; IF qualquer dado estiver ausente, THEN THE Aplicação SHALL omitir o tooltip para aquele ponto.
5. THE Aplicação SHALL renderizar todos os gráficos usando exclusivamente Design_Tokens de cor (paleta azul/dourado do Cruzeiro), sem cores hardcoded.
6. WHERE o dispositivo for mobile (largura < 480px), THE Aplicação SHALL renderizar gráficos com altura mínima de 200px e rolagem horizontal habilitada quando o número de pontos exceder a largura disponível.
7. WHEN os gráficos carregam, THE Aplicação SHALL exibir Skeleton no formato do gráfico até que os dados estejam disponíveis.
8. IF um Jogador tiver menos de 2 Partidas avaliadas, THEN THE Aplicação SHALL substituir o LineChart pela mensagem "Dados insuficientes para gráfico (mínimo 2 partidas)"; IF o Jogador tiver exatamente 2 Partidas avaliadas, THEN THE Aplicação SHALL renderizar o LineChart completo.


### Requirement 30: Animações e Microinterações

**User Story:** Como Usuário, quero animações fluidas e microinterações que deem feedback visual às minhas ações, para que a experiência seja premium e responsiva.

#### Acceptance Criteria

1. WHEN o Router executa uma transição entre páginas, THE Aplicação SHALL executar animação de fade (opacidade 0→1) com duração de exatamente 200ms na página de destino.
2. WHEN dados numéricos (contadores, médias, totais) são carregados em tela, THE Aplicação SHALL animar a contagem progressiva do valor 0 ao valor final em 800ms.
3. WHEN um Usuário submete uma avaliação com sucesso, THE Aplicação SHALL exibir o toast de confirmação com animação de deslize de baixo para cima.
4. THE Carta_FIFA SHALL exibir transição de gradiente de brilho ao receber hover em desktop, com duração máxima de 300ms, nunca em loop automático.
5. WHEN a Contagem_Regressiva atinge um novo segundo, THE Aplicação SHALL atualizar os dígitos com animação de troca vertical (flip) sem flickering.
6. WHEN Componentes Skeleton são substituídos por conteúdo real, THE Aplicação SHALL executar fade-in de 150ms nos elementos carregados.
7. WHEN a preferência `prefers-reduced-motion: reduce` está ativa, THE Aplicação SHALL desativar todas as animações não essenciais, mantendo transições de estado (hover, foco) com duração de no máximo 50ms.


### Requirement 31: Notificações e Feedback ao Usuário

**User Story:** Como Usuário, quero notificações visuais claras sobre o resultado de cada ação, para que eu saiba se minhas operações foram bem-sucedidas ou se ocorreu algum problema.

#### Acceptance Criteria

1. THE Aplicação SHALL exibir notificação toast no canto inferior direito para eventos de sucesso, erro ou informação, com duração de 3 segundos antes de desaparecer automaticamente.
2. THE Aplicação SHALL diferenciar visualmente os toasts por tipo, usando Design_Tokens semânticos: sucesso, erro e informação.
3. WHEN múltiplos toasts são exibidos simultaneamente, THE Aplicação SHALL empilhá-los verticalmente sem sobreposição.
4. WHEN qualquer requisição ao Supabase retorna status HTTP diferente de 2xx, THE Aplicação SHALL exibir toast de erro com mensagem descritiva em português, sem expor detalhes técnicos internos.
5. WHEN o Admin executa uma operação em lote com sucesso parcial (alguns itens importados, outros rejeitados por validação), THE Aplicação SHALL exibir toast de informação com o número de sucessos e falhas.


### Requirement 32: Performance e Otimização

**User Story:** Como Usuário, quero que a aplicação carregue rapidamente e responda de forma fluida, para que a experiência seja agradável mesmo em conexões móveis.

#### Acceptance Criteria

1. THE Aplicação SHALL implementar paginação ou virtualização para listas com mais de 50 itens (Elenco, Rankings, Feed de Atividade), renderizando no máximo 20 itens por página ou janela de visualização.
2. THE Aplicação SHALL implementar lazy loading para imagens de Jogadores, carregando apenas as imagens visíveis na viewport atual.
3. THE Cache SHALL armazenar os dados da Tabela_squad, Tabela_fixtures, Tabela_game_scores e Tabela_permanent_scores com TTL de 5 minutos para dados de leitura frequente.
4. THE Aplicação SHALL agrupar requisições paralelas independentes ao Supabase usando `Promise.all`, evitando requisições sequenciais desnecessárias para dados não dependentes.
5. THE Aplicação SHALL implementar debounce de 300ms nos campos de busca e filtro para evitar requisições excessivas durante a digitação.
6. WHEN o Cache de dados de rankings ou médias expira, THE Aplicação SHALL recalcular rankings e médias em conjunto na mesma operação de recarga, garantindo consistência entre os valores exibidos.
7. WHEN o Vite gera o bundle de produção, THE Aplicação SHALL produzir chunks separados por rota (code splitting por rota), permitindo carregamento sob demanda.


### Requirement 33: Responsividade e Acessibilidade

**User Story:** Como Usuário em qualquer dispositivo, quero que a interface se adapte perfeitamente à tela e seja navegável com teclado e leitores de tela, para que a plataforma seja inclusiva e utilizável em mobile, tablet e desktop.

#### Acceptance Criteria

1. THE Aplicação SHALL ser responsiva com breakpoints em 480px (mobile), 768px (tablet), 1024px e 1200px (desktop), adaptando a grade de Carta_FIFA de 1 coluna (mobile) até 5 colunas (desktop).
2. THE Aplicação SHALL exibir menu de navegação colapsado em hambúrguer em viewports com largura inferior a 768px.
3. THE Aplicação SHALL tornar todos os elementos interativos (botões, links, inputs, cartas) acessíveis via navegação por teclado com foco visível destacado.
4. THE Aplicação SHALL incluir atributos `aria-label` em português em todos os botões que contenham apenas ícones, descrevendo sua ação.
5. THE Aplicação SHALL manter contraste de cor mínimo de 4.5:1 entre texto e plano de fundo em todos os Componentes, conforme WCAG 2.1 Nível AA.
6. THE Aplicação SHALL incluir atributos `alt` descritivos em todas as imagens de Jogadores e logos de times.
7. WHEN um modal é aberto, THE Aplicação SHALL mover o foco do teclado para o primeiro elemento interativo dentro do modal e prender o ciclo de foco enquanto este estiver aberto.
8. WHEN um modal é fechado, THE Aplicação SHALL retornar o foco do teclado ao elemento que disparou a abertura do modal.
9. THE Aplicação SHALL definir alvos de toque com no mínimo 44×44px em dispositivos móveis.
10. THE Aplicação SHALL usar elementos HTML semânticos adequados: `<nav>`, `<main>`, `<section>`, `<article>`, `<header>`, `<footer>`, `<h1>`–`<h3>` em hierarquia coerente.


### Requirement 34: PWA e Lembretes de Partida

**User Story:** Como Usuário, quero instalar o JeanScore como aplicativo e receber lembretes antes das partidas, para que eu não esqueça de acompanhar e avaliar cada jogo.

#### Acceptance Criteria

1. THE Aplicação SHALL fornecer um manifesto PWA e um service worker que a tornem instalável em dispositivos compatíveis.
2. WHEN o dispositivo suporta instalação de PWA e o Usuário ainda não instalou, THE Aplicação SHALL oferecer a ação "Instalar aplicativo" de forma não intrusiva.
3. WHILE offline, THE Aplicação SHALL exibir o conteúdo previamente armazenado em Cache pelo service worker, com indicação de estado offline.
4. WHERE o Usuário concede permissão de notificações, THE Aplicação SHALL agendar um lembrete pré-jogo para a próxima Partida agendada.
5. WHEN o horário do lembrete pré-jogo é atingido, THE Aplicação SHALL notificar o Usuário sobre a Partida próxima com mensagem em português.
6. IF o Usuário não concede permissão de notificações, THEN THE Aplicação SHALL continuar funcionando normalmente sem enviar lembretes, sem repetir o pedido de permissão de forma intrusiva.


---

## Propriedades de Corretude (Property-Based Testing)

> As propriedades a seguir exercitam a camada de Domínio agnóstica de framework (scoring, Raridade_Carta, filtros, busca, serialização, ranking, estatísticas, Fan_Score e Conquistas), independente de React.

### Parser e Serialização

**P1 — Round-trip de Avaliação (Serialização/Deserialização)**
Para toda Avaliação com nota `n ∈ [0, 10]` com passo 0.5, serializar para JSON e deserializar deve produzir o mesmo valor:
```
∀ n ∈ {0.0, 0.5, 1.0, ..., 10.0}: deserialize(serialize({ score: n })).score === n
```
Justificativa: parsing de float em JSON é sensível à precisão de ponto flutuante; round-trip garante que notas não sofram deriva numérica.

**P2 — Round-trip de Fixture (Supabase → Domínio → Supabase)**
Para toda `SupabaseFixtureRow` válida, a conversão para o tipo de domínio `Fixture` e de volta para `SupabaseFixtureRow` deve produzir um objeto equivalente:
```
∀ row: SupabaseFixtureRow: toSupabaseRow(toFixture(row)) ≡ row
```

### Invariantes

**P3 — Raridade determinística da Carta_FIFA**
Para todo Jogador com `avg ∈ [0, 10]`, a função `calcRarity(avg)` deve retornar exatamente uma Raridade_Carta:
```
∀ avg ∈ [0.0..10.0]: calcRarity(avg) ∈ { 'bronze', 'silver', 'gold', 'legendary' }
∀ avg1, avg2: avg1 === avg2 → calcRarity(avg1) === calcRarity(avg2)
```

**P4 — Normalização de nota no intervalo [0, 10]**
Para todo valor de entrada `v` submetido como nota, `normalizeScore(v)` deve retornar um valor `n ∈ [0, 10]` com passo 0.5:
```
∀ v: number: normalizeScore(v) >= 0 ∧ normalizeScore(v) <= 10 ∧ normalizeScore(v) % 0.5 === 0
```

**P5 — Média calculada é invariante à ordem dos votos**
Para qualquer conjunto de notas `[n1, n2, ..., nk]`, a média deve ser igual independente da ordem dos elementos:
```
∀ scores: number[]: calcAverage(scores) === calcAverage(shuffle(scores))
```

**P6 — Filtro de posição não altera tamanho total**
Para qualquer lista de Jogadores `players`, a soma dos resultados filtrados por cada Posição deve igualar o total de Jogadores:
```
∀ players: Player[]: filterByPosition(players, 'all').length === players.length
sum(positions.map(p => filterByPosition(players, p).length)) === players.length
```

### Propriedades Metamórficas

**P7 — Ordenação por nota é estável e monotônica**
Para qualquer lista de Jogadores com notas, a lista ordenada por nota decrescente deve satisfazer:
```
∀ i < j: sortedPlayers[i].avg >= sortedPlayers[j].avg (excluindo nulls no final)
```

**P8 — Filtro de busca é subconjunto**
Para qualquer termo de busca `q` e lista `items`, os resultados filtrados devem ser subconjunto da lista original:
```
∀ q, items: search(items, q).length <= items.length
∀ item ∈ search(items, q): items.includes(item)
```

**P9 — Filtros combinados são mais restritivos que filtros individuais**
Para filtros de posição e intervalo de nota aplicados em combinação:
```
∀ players, pos, minScore, maxScore:
  filterCombined(players, pos, minScore, maxScore).length <=
  filterByPosition(players, pos).length
```

**P14 — Fan_Score é monotônico não decrescente**
Para qualquer sequência de ações pontuáveis aplicadas ao Fan_Score de um Usuário_Autenticado, o Fan_Score resultante nunca diminui:
```
∀ score, action: applyFanScore(score, action) >= score
```

**P15 — Nível_de_Torcedor é monotônico em relação ao Fan_Score**
Para quaisquer dois valores de Fan_Score, um Fan_Score maior nunca resulta em um Nível_de_Torcedor inferior:
```
∀ s1, s2: s1 <= s2 → levelIndex(fanLevel(s1)) <= levelIndex(fanLevel(s2))
fanLevel(s) ∈ { 'iniciante', 'torcedor', 'apaixonado', 'especialista', 'lenda' }
```

**P16 — Seleção do Time da Comunidade do Mês respeita a Posição**
Para qualquer conjunto de Notas_de_Jogo do período, cada Jogador escolhido para uma vaga da formação ocupa a Posição correspondente à vaga:
```
∀ slot ∈ teamOfMonth(scores, formation): slot.player.position === slot.requiredPosition
```

### Idempotência

**P10 — Normalização de score é idempotente**
Aplicar a normalização de score duas vezes produz o mesmo resultado:
```
∀ v: normalizeScore(normalizeScore(v)) === normalizeScore(v)
```

**P11 — Cache set/get é idempotente para chave repetida**
Definir o mesmo valor no Cache duas vezes e ler de volta deve retornar o mesmo valor:
```
∀ key, data: cacheSet(key, data); cacheSet(key, data); cacheGet(key) === data
```

**P17 — Desbloqueio de Conquista é idempotente**
Reavaliar as Conquistas de um Usuário_Autenticado que já as desbloqueou não altera o conjunto de Conquistas desbloqueadas nem as duplica:
```
∀ profile: evaluateAchievements(evaluateAchievements(profile)) ≡ evaluateAchievements(profile)
```

### Condições de Erro

**P12 — Rejeição de nota inválida**
Para valores fora do intervalo [0, 10], o sistema de avaliação deve rejeitar a submissão:
```
∀ v > 10 || v < 0: submitScore(v) → Error (não salva na Tabela_game_scores)
```

**P13 — Busca com caracteres especiais não lança exceção**
Para qualquer string arbitrária `q` incluindo caracteres especiais de regex:
```
∀ q: string: search(items, q) nunca lança exceção (retorna [] no pior caso)
```
