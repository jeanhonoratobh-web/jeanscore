# JeanScore — Design System

> Linguagem visual única do produto. Prosa em português; tokens, nomes de componentes e código em inglês; toda cópia de UI de exemplo em português do Brasil. Toda interface do JeanScore deve ser construída a partir destes tokens e componentes. Nenhum valor visual (cor, espaçamento, sombra) deve ser "hardcoded" fora deste sistema.

---

## 1. Foundations: Design Tokens

Os tokens são a fonte única da verdade visual. São expostos como **CSS Custom Properties** (variáveis CSS) e tipados em TypeScript (`src/theme/tokens.ts`). Temas sobrescrevem apenas os valores dos tokens — nunca os componentes (ver seção 20).

### Convenção de nomes (inglês)
`--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--duration-*`, `--ease-*`.

## 2. Color Palette

### Marca (tema padrão: Cruzeiro)
| Token | Valor | Uso |
|-------|-------|-----|
| `--color-primary` | `#0033A0` | Azul Cruzeiro — ações primárias, links, destaque de marca |
| `--color-primary-strong` | `#00257A` | Estados hover/pressed do primário |
| `--color-primary-soft` | `#E6ECF7` | Fundos suaves, seleção, chips |
| `--color-accent` | `#D4AF37` | Dourado — realces premium, cartas lendárias, prêmios |
| `--color-accent-strong` | `#B8942B` | Hover do dourado |

### Superfícies e texto
| Token | Valor (claro) | Uso |
|-------|---------------|-----|
| `--color-bg` | `#F5F7FB` | Fundo da aplicação |
| `--color-surface` | `#FFFFFF` | Cards, painéis, modais |
| `--color-surface-2` | `#EEF1F7` | Superfície secundária, skeletons |
| `--color-border` | `#D9DEE8` | Bordas, divisores |
| `--color-text` | `#0E1524` | Texto principal |
| `--color-text-muted` | `#5B6577` | Texto secundário, legendas |
| `--color-text-inverse` | `#FFFFFF` | Texto sobre superfícies escuras/primárias |

### Semânticas (feedback)
| Token | Valor | Uso |
|-------|-------|-----|
| `--color-success` | `#1E9E5A` | Sucesso, notas altas |
| `--color-warning` | `#E8A317` | Atenção, sucesso parcial |
| `--color-danger` | `#D64545` | Erro, ações destrutivas |
| `--color-info` | `#2B7FD6` | Informação neutra |

### Raridade de carta (card rarity)
| Token | Faixa de nota | Tratamento visual |
|-------|---------------|-------------------|
| `--rarity-bronze` | nota < 6 | Bronze fosco |
| `--rarity-silver` | 6 ≤ nota < 7 | Prata |
| `--rarity-gold` | 7 ≤ nota < 8 | Ouro |
| `--rarity-legendary` | nota ≥ 8 | Preto & Dourado com brilho |

> Contraste: todas as combinações texto/fundo devem atingir no mínimo **WCAG AA** (4.5:1 para texto normal, 3:1 para texto grande e ícones essenciais).

## 3. Typography

- **Família de UI:** `Inter` (fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).
- **Família de destaque (display / números de card):** `Montserrat` ou equivalente condensado para números de rating.

Escala tipográfica (token → tamanho / line-height / peso):
| Token | Tamanho | Line-height | Peso | Uso |
|-------|---------|-------------|------|-----|
| `--font-display` | 40px | 1.1 | 800 | Hero, títulos de destaque |
| `--font-h1` | 32px | 1.2 | 700 | Título de página |
| `--font-h2` | 24px | 1.25 | 700 | Seção |
| `--font-h3` | 20px | 1.3 | 600 | Subseção, título de card |
| `--font-body` | 16px | 1.5 | 400 | Texto padrão |
| `--font-body-sm` | 14px | 1.5 | 400 | Texto secundário |
| `--font-caption` | 12px | 1.4 | 500 | Legendas, rótulos, tooltips |

## 4. Spacing

Escala base **4px**. Usar somente estes tokens para margin/padding/gap:
`--space-0: 0` · `--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-5: 24px` · `--space-6: 32px` · `--space-7: 48px` · `--space-8: 64px`.

## 5. Grid & Layout

- **Container máximo:** 1200px, centralizado, com padding lateral `--space-4` (mobile) a `--space-6` (desktop).
- **Grid de cartas (FifaCard):** 1 coluna (<480px), 2 (≥480px), 3 (≥768px), 4 (≥1024px), 5 (≥1200px).
- **Layout base:** header fixo no topo, conteúdo roteado no centro, footer ao final; nav lateral não é usada (foco mobile-first).
- **Gutters:** gap `--space-4` entre itens de grid.

## 6. Elevation (Shadows)

| Token | Valor | Uso |
|-------|-------|-----|
| `--shadow-0` | none | Elementos rentes |
| `--shadow-1` | `0 1px 2px rgba(14,21,36,.08)` | Cards em repouso |
| `--shadow-2` | `0 4px 12px rgba(14,21,36,.12)` | Cards em hover, dropdowns |
| `--shadow-3` | `0 12px 32px rgba(14,21,36,.18)` | Modais, painéis flutuantes |
| `--shadow-glow` | brilho dourado | Cartas lendárias e destaques premium |

Camadas Z (`--z-*`): `base: 0`, `dropdown: 100`, `sticky-header: 200`, `overlay: 300`, `modal: 400`, `toast: 500`.

## 7. Radius

`--radius-sm: 6px` (inputs, chips) · `--radius-md: 10px` (cards, botões) · `--radius-lg: 16px` (painéis, modais) · `--radius-full: 9999px` (avatares, badges, pills).

## 8. Motion & Animations

- **Durations:** `--duration-fast: 150ms`, `--duration-base: 200ms`, `--duration-slow: 300ms`, `--duration-count: 800ms` (count-up).
- **Easings:** `--ease-standard: cubic-bezier(.2,0,0,1)`, `--ease-emphasized: cubic-bezier(.2,0,0,1.2)`.
- **Padrões:** fade/slide de rota (200ms), count-up de números (800ms), brilho de card **somente no hover** (≤300ms), entrada de pódio ao rolar, flip vertical do countdown sem flicker.
- **Acessibilidade:** respeitar `prefers-reduced-motion: reduce` desabilitando animações não essenciais.
- **Regra de ouro:** animação reforça hierarquia e emoção; nunca bloqueia interação nem excede 300ms para microinterações.

## 9. Iconography

- Conjunto único de ícones de linha (stroke) coerente (ex.: Lucide), 24px base, `currentColor`.
- Ícones puramente decorativos: `aria-hidden="true"`. Ícones acionáveis: `aria-label` em português.

---

## Component Library

Cada componente é reutilizável, temável via tokens e independente de página. Nomes em inglês; conteúdo/props de texto em português.

## 10. Cards

- **`FifaCard`** — carta-assinatura do jogador: rating 0–99 (canto superior esquerdo), abreviação de posição, foto, nome, nota da temporada, votos; borda/tratamento por raridade; brilho apenas no hover. Variantes: `default`, `compact`, `legendary`.
- **`MatchCard`** — partida: escudos/nomes, placar ou "vs", competição, data, nota média da escalação.
- **`RankingCard` / `PodiumCard`** — colocação em ranking e pódio (1º/2º/3º) com entrada animada.
- **`CollectionCard`** — item de coleção colecionável (estado: bloqueado / desbloqueado).
- **`AchievementCard`** — conquista com ícone, título e descrição (em português), estado desbloqueada/pendente.
- **`StatCard`** — número-destaque com rótulo e variação (count-up).

## 11. Buttons

Variantes: `primary`, `secondary`, `ghost`, `danger`, `icon`. Tamanhos: `sm`, `md`, `lg`. Estados: default, hover, active, focus-visible (anel visível), disabled, loading (spinner + rótulo desabilitado). Rótulos sempre em português (ex.: "Avaliar jogadores", "Salvar", "Tentar novamente").

## 12. Inputs & Forms

- **`TextField`, `NumberField` (nota 0–10 passo 0.5), `Select`, `RangeSlider` (intervalo de nota), `SearchInput`, `Toggle`.**
- Estados: default, focus, error (borda `--color-danger` + mensagem), disabled.
- Todo campo tem `label` associado (português) e mensagens de validação específicas em português.
- Placeholders em português (ex.: "Buscar jogador, partida ou competição").

## 13. Navigation

- **`Header`** fixo com logo, nome do usuário (quando autenticado) e ação de busca.
- **`NavBar`** com links de rota e indicador de link ativo; colapsa em **menu hambúrguer** abaixo de 768px.
- **`Tabs`** (ex.: "Próximos"/"Anteriores") e **`Breadcrumb`** quando aplicável.
- **`QuickNav`** — âncoras rápidas na homepage.
- Rótulos em português; toda navegação acessível por teclado com foco visível.

## 14. Charts

- **`LineChart`** — evolução de desempenho (cronológica).
- **`Histogram`** — distribuição de notas (10 faixas).
- **`RadarChart`** — perfil/comparação de atributos do jogador.
- Paleta azul/dourado; tooltips condicionais em português; rolagem horizontal em mobile; mensagem "Dados insuficientes" quando aplicável.

## 15. Modals & Overlays

- **`Modal`** com foco preso (move foco ao primeiro elemento, prende o ciclo, retorna foco ao disparador ao fechar), overlay com `--z-modal`, fechar por `Escape` e clique fora.
- **`ConfirmDialog`** para ações destrutivas (exclusões) com resumo do item afetado (português).
- **`SearchPanel`** — busca global sobreposta (abre com `/`, fecha com `Escape`).

## 16. Badges & Chips

- **`Badge`** — nível de torcedor, conquista, "Em alta"/"Em baixa" (rótulos em português).
- **`RarityTag`** — Bronze/Prata/Ouro/Lendária.
- **`Chip`** — filtros ativos (competição, posição) removíveis.

## 17. Loading States

- **`Skeleton`** por seção, no formato do conteúdo real (card, lista, gráfico); substituição por fade-in.
- **`Spinner`** para ações em progresso (ex.: submissão de notas).
- Mensagens de carregamento em português quando textuais (ex.: "Carregando elenco...").

## 18. Empty States

- Componente **`EmptyState`** com ilustração/ícone, mensagem em português e ação de recuperação quando aplicável (ex.: "Não foi possível carregar o elenco" + "Tentar novamente"; "Nenhum resultado para '[termo]'").

## 19. Responsive Rules

- **Breakpoints:** 480px (mobile), 768px (tablet), 1024px, 1200px (desktop).
- Mobile-first: estilos base para o menor, ampliados por `min-width`.
- Grade de cartas de 1 a 5 colunas; navegação em hambúrguer < 768px; gráficos roláveis em mobile.
- Alvos de toque ≥ 44×44px.

## 20. Theming Architecture

- Cada tema é um conjunto de valores para os mesmos tokens, aplicado via atributo no elemento raiz: `[data-theme="cruzeiro" | "dark" | "black-gold" | "retro-2003" | "libertadores"]`.
- Componentes **nunca** referenciam cores literais — apenas tokens. Trocar de tema = trocar o mapa de tokens, sem tocar em componentes.
- Preferência de tema persistida (ex.: `localStorage`), com respeito a `prefers-color-scheme` para o tema Noturno como padrão opcional.
- Temas previstos: **Cruzeiro (padrão)**, **Modo Noturno**, **Black & Gold**, **Retrô 2003**, **Libertadores**.

## 21. Motion Guidelines (resumo aplicado)

1. Microinterações ≤ 300ms; transições de rota ~200ms; count-up ~800ms.
2. Entrada de conteúdo por fade/slide sutil; nunca "pular" layout (evitar layout shift).
3. Brilho de card e efeitos premium só sob interação (hover/scroll), nunca em loop automático.
4. Sempre honrar `prefers-reduced-motion`.

---

## Enforcement

- Nenhuma cor, espaçamento, raio, sombra ou duração pode ser definido fora dos tokens.
- Nenhuma string de UI em inglês; nenhum identificador técnico em português.
- Todo novo componente entra nesta biblioteca antes de ser usado em uma página (component-first).
