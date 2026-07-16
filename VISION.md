# JeanScore — Product Vision

> Documento fundacional do produto. Toda decisão futura de requisitos, design e implementação deve ser coerente com esta visão. Prosa em português; identificadores técnicos, nomes de arquivos, pastas e código em inglês; toda cópia de interface (UI) em português do Brasil.

---

## 1. Product Vision

JeanScore é a plataforma digital premium da torcida do Cruzeiro para viver, avaliar e celebrar cada partida. Não é um sistema administrativo nem um CRUD: é um produto de futebol construído para gerar emoção, pertencimento e o hábito de voltar depois de todo jogo.

A cada rodada, o torcedor abre o JeanScore para dar sua nota aos jogadores, descobrir o Craque da Partida da comunidade, montar o Time da Comunidade do Mês, acompanhar a evolução dos seus ídolos em cartas colecionáveis e comparar desempenhos como um verdadeiro olheiro. A administração existe apenas para sustentar essa experiência — o futebol é sempre o protagonista.

## 2. Mission

Dar à torcida do Cruzeiro uma voz coletiva e mensurável sobre o desempenho do time, transformando a opinião de cada torcedor em estatística viva, colecionável e compartilhável — com qualidade visual e de experiência à altura de um produto oficial.

## 3. Target Audience

- Torcedores do Cruzeiro que acompanham todas as partidas e querem opinar.
- Torcedores estatísticos que gostam de números, rankings e comparações.
- Torcedores casuais que querem uma forma leve e divertida de participar.
- Comunidade que valoriza pertencimento, reconhecimento e status entre pares.

O produto é primariamente mobile (o torcedor avalia logo após o apito final, no celular), mas premium em qualquer tela.

## 4. Personas

### Persona 1 — "O Cabuloso Raiz" (torcedor apaixonado)
- **Perfil:** acompanha todos os jogos, no estádio ou na TV. Emotivo, opinativo.
- **Objetivo:** dar sua nota logo após o jogo e ver se a comunidade concorda com ele.
- **Necessidades:** avaliação rápida no celular, Craque da Partida, feed da comunidade.
- **Frustração hoje:** não tem onde registrar e comparar sua opinião com a de outros torcedores.

### Persona 2 — "A Analista de Arquibancada" (torcedora estatística)
- **Perfil:** gosta de dados, evolução, consistência, comparação entre jogadores.
- **Objetivo:** entender quem está em alta, quem rende em cada competição, comparar dois jogadores.
- **Necessidades:** perfil de jogador estilo scouting, gráficos de radar, comparação lado a lado, rankings.
- **Frustração hoje:** dados dispersos, sem histórico nem visualização.

### Persona 3 — "O Colecionador" (torcedor engajado por recompensa)
- **Perfil:** motivado por conquistas, coleções, níveis e status.
- **Objetivo:** subir de nível de torcedor, desbloquear conquistas, completar coleções de cartas.
- **Necessidades:** Fan Score, conquistas, coleções, badges, perfil pessoal.
- **Frustração hoje:** nenhum sistema recompensa a participação contínua.

### Persona 4 — "O Curador" (administrador / moderador)
- **Perfil:** organiza elenco, partidas, escalações e aprova membros.
- **Objetivo:** manter os dados corretos com o mínimo de atrito.
- **Necessidades:** painel eficiente, importação em lote, confirmações seguras, auditoria.
- **Prioridade:** secundária — a administração serve à experiência do torcedor.

## 5. Product Principles

1. **Futebol primeiro, administração depois.** Cada decisão prioriza a experiência do torcedor.
2. **Emoção mensurável.** Toda opinião vira estatística viva, colecionável e comparável.
3. **Volte depois de cada jogo.** O produto cria um ciclo de retorno a cada rodada (avaliar → descobrir → ser recompensado).
4. **A comunidade é a estrela.** O valor nasce da soma das opiniões; o produto celebra a coletividade, não a competição entre pessoas.
5. **Recompensar participação, não rivalidade.** Gamificação premia presença e contribuição, nunca expõe torcedores de forma negativa.
6. **Premium por padrão.** Qualidade visual, microinterações e polimento em todos os detalhes.
7. **Componível e extensível.** Novas conquistas, coleções, temas e telas entram sem reescrever o que existe.
8. **Duas línguas, sem mistura.** Tudo que o usuário vê em português do Brasil; tudo técnico em inglês.

## 6. UX Principles

1. **Imersão:** a interface transporta o torcedor para o universo do Cruzeiro (identidade visual, cartas, pódios).
2. **Zero fricção para avaliar:** avaliar uma partida é a ação mais fácil e rápida do app.
3. **Descoberta contínua:** sempre há algo novo para explorar (em alta, comparações, coleções, Time do Mês).
4. **Feedback imediato:** toda ação responde com toast, animação ou atualização visível.
5. **Recompensa progressiva:** o torcedor percebe evolução (Fan Score, níveis, conquistas) sem esforço extra.
6. **Clareza em qualquer tela:** mobile-first, responsivo, legível, tocável.
7. **Respeito ao usuário:** acessibilidade, `prefers-reduced-motion`, estados vazios úteis, mensagens humanas.

## 7. Design Principles

1. **Identidade Cruzeiro:** azul celeste e dourado como base emocional da marca.
2. **Linguagem visual única:** um Design System governa cores, tipografia, espaçamento, componentes e movimento (ver `DESIGN_SYSTEM.md`).
3. **Cartas como herói visual:** o card de jogador estilo Ultimate Team é o elemento-assinatura do produto.
4. **Movimento com propósito:** animações premium reforçam emoção e hierarquia, nunca distraem.
5. **Temável desde a base:** design tokens permitem múltiplos temas (Cruzeiro, Noturno, Black & Gold, Retrô 2003, Libertadores) sem refatoração.
6. **Componível:** telas são composições de componentes reutilizáveis, não peças únicas.
7. **Consistência acima de novidade:** padrões repetidos reduzem carga cognitiva.

## 8. Success Metrics

**Engajamento (norte do produto):**
- Retorno por rodada: % de torcedores ativos que avaliam a cada partida liberada.
- Avaliações por partida e taxa de participação da comunidade.
- Retenção D7 / D30 e retenção por temporada.

**Profundidade de experiência:**
- Sessões que usam comparação de jogadores, perfis e rankings.
- Conquistas desbloqueadas por torcedor e distribuição de níveis de torcedor.
- Coleções iniciadas e completadas.

**Crescimento:**
- Novos cadastros por rodada.
- Cards e Time da Comunidade do Mês compartilhados externamente.

**Qualidade:**
- Tempo até primeira avaliação (onboarding).
- Performance percebida (carregamento, fluidez) e acessibilidade (conformidade AA).

## 9. Long-Term Vision

JeanScore se torna a referência de opinião coletiva da torcida do Cruzeiro — um "termômetro oficial da arquibancada". Com o tempo, evolui de plataforma de avaliação para um ecossistema de engajamento: histórico de temporadas, coleções permanentes, previsões pré-jogo, e uma comunidade reconhecida que influencia a narrativa em torno do time. A arquitetura componível e temável permite expandir para outras dimensões (novas competições, novos formatos de card, eventos sazonais) sem reescrever o núcleo.

## 10. Future Roadmap

> Roadmap indicativo; a priorização exata é definida a cada ciclo à luz das métricas de sucesso.

**Fase 1 — Fundação Premium (núcleo do JeanScore 2.0)**
- Migração para React + TypeScript + Vite, Design System, componentização.
- Homepage premium, elenco em cartas, perfil de jogador, detalhe de partida, avaliação, rankings, busca global, painel admin.

**Fase 2 — Comunidade & Identidade**
- Perfil do usuário, Fan Score, níveis de torcedor, conquistas, badges.
- Feed da comunidade aprimorado, Craque da Partida.

**Fase 3 — Descoberta & Coleção**
- Time da Comunidade do Mês, comparação de jogadores, coleções colecionáveis.
- Perfil de jogador estilo scouting (radar, forças/fraquezas, tendências).

**Fase 4 — Retorno & Alcance**
- PWA instalável, lembretes de partida (notificações), onboarding.
- Palpites pré-jogo, cards e Time do Mês compartilháveis.

**Fase 5 — Ecossistema**
- Temas adicionais, histórico de temporadas, eventos sazonais, expansões da gamificação.

---

## Enforced Language Rule (produto)

- **Inglês (técnico):** código, variáveis, classes, componentes, funções, banco de dados, SQL, documentação de código, arquitetura, nomes de pastas, nomes de arquivos, comentários.
- **Português do Brasil (UI):** botões, menus, páginas, navegação, notificações, formulários, placeholders, mensagens, erros, sucessos, conquistas, badges, estatísticas, tooltips, gráficos, rótulos, estados vazios, mensagens de carregamento.
- **Nunca misturar** os dois na interface. A experiência deve parecer um aplicativo nativo brasileiro.
