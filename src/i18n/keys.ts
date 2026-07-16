/**
 * Canonical i18n key type — the single technical source of every UI string.
 *
 * Per the two-language rule (Requirement 2), every user-facing string is
 * referenced through a technical key in English ({@link I18nKey}) and resolved
 * to a pt-BR text by the i18n dictionary (`pt-BR.ts`, task 13.3). Components
 * never hardcode pt-BR literals; they always resolve text via a key
 * (Requirements 2.3, 2.4). Keeping keys as a literal union (rather than a bare
 * `string`) makes the dictionary exhaustively checkable at compile time and
 * prevents typos or divergent key spellings across the codebase (Requirement
 * 2.2).
 *
 * Keys use dot-notation namespaced by product area (`area.section.item`). This
 * module is the canonical home of the type: `types/domain.ts` and every
 * component import {@link I18nKey} from here (via the `i18n` or `types` barrels)
 * so there is exactly one definition.
 *
 * The union below is intentionally comprehensive but not frozen — new keys are
 * added here as new UI is built, and the pt-BR dictionary must cover each one.
 */
export type I18nKey =
  // -------------------------------------------------------------------------
  // Brand / app-level
  // -------------------------------------------------------------------------
  | 'app.name'
  | 'app.tagline'

  // -------------------------------------------------------------------------
  // Navigation (Requirements 3.2, 12.1, 12.8)
  // -------------------------------------------------------------------------
  | 'nav.home'
  | 'nav.squad'
  | 'nav.players'
  | 'nav.compare'
  | 'nav.matches'
  | 'nav.rankings'
  | 'nav.teamOfMonth'
  | 'nav.collections'
  | 'nav.profile'
  | 'nav.rate'
  | 'nav.admin'
  | 'nav.search'
  | 'nav.menu'
  | 'nav.theme'

  // -------------------------------------------------------------------------
  // Common actions / buttons
  // -------------------------------------------------------------------------
  | 'common.save'
  | 'common.cancel'
  | 'common.confirm'
  | 'common.close'
  | 'common.back'
  | 'common.next'
  | 'common.previous'
  | 'common.continue'
  | 'common.skip'
  | 'common.submit'
  | 'common.edit'
  | 'common.delete'
  | 'common.remove'
  | 'common.add'
  | 'common.retry'
  | 'common.seeMore'
  | 'common.seeAll'
  | 'common.share'
  | 'common.select'
  | 'common.search'
  | 'common.filter'
  | 'common.sort'
  | 'common.yes'
  | 'common.no'
  | 'common.login'
  | 'common.logout'
  | 'common.register'

  // -------------------------------------------------------------------------
  // Generic states: loading / empty / error (Requirements 2.1, 15.10)
  // -------------------------------------------------------------------------
  | 'state.loading'
  | 'state.empty'
  | 'state.error'
  | 'state.offline'
  | 'state.staleData'
  | 'state.noData'
  | 'state.insufficientData'

  // -------------------------------------------------------------------------
  // Authentication (Requirement 6)
  // -------------------------------------------------------------------------
  | 'auth.login.title'
  | 'auth.login.usernameLabel'
  | 'auth.login.usernamePlaceholder'
  | 'auth.login.passwordLabel'
  | 'auth.login.passwordPlaceholder'
  | 'auth.login.submit'
  | 'auth.register.title'
  | 'auth.register.usernameLabel'
  | 'auth.register.emailLabel'
  | 'auth.register.emailPlaceholder'
  | 'auth.register.passwordLabel'
  | 'auth.register.submit'
  | 'auth.register.success' // registration confirmation (Requirement 6.1)
  | 'auth.error.usernameTaken' // "Nome de usuário já existe" (Requirement 6.2)
  | 'auth.error.emailTaken' // "E-mail já cadastrado" (Requirement 6.3)
  | 'auth.error.usernameTooShort'
  | 'auth.error.passwordTooShort'
  | 'auth.error.invalidEmail'
  | 'auth.error.invalidCredentials'
  | 'auth.error.pending' // "Cadastro ainda não aprovado" (Requirement 6.5)
  | 'auth.error.rejected' // "Cadastro recusado" (Requirement 6.6)
  | 'auth.logout.success'
  | 'auth.header.greeting' // greeting with {username} (Requirement 6.10)

  // -------------------------------------------------------------------------
  // Onboarding (Requirement 7)
  // -------------------------------------------------------------------------
  | 'onboarding.welcome.title'
  | 'onboarding.welcome.subtitle'
  | 'onboarding.step.rating.title'
  | 'onboarding.step.rating.body'
  | 'onboarding.step.fanScore.title'
  | 'onboarding.step.fanScore.body'
  | 'onboarding.step.collections.title'
  | 'onboarding.step.collections.body'
  | 'onboarding.action.firstRating' // "Fazer minha primeira avaliação" (Requirement 7.3)
  | 'onboarding.action.skip' // "Pular" (Requirement 7.5)
  | 'onboarding.noFixture' // "Explore o elenco enquanto o próximo jogo não chega" (Requirement 7.4)

  // -------------------------------------------------------------------------
  // User profile (Requirement 8)
  // -------------------------------------------------------------------------
  | 'profile.title'
  | 'profile.memberSince' // "Membro Desde" (Requirement 8.1)
  | 'profile.stats.title'
  | 'profile.stats.totalRatings' // "Total de Avaliações" (Requirement 8.2)
  | 'profile.stats.matchesRated' // "Jogos Avaliados" (Requirement 8.2)
  | 'profile.stats.favoritePlayer' // "Jogador Favorito" (Requirement 8.2)
  | 'profile.achievements.title'
  | 'profile.badges.title'
  | 'profile.recentActivity.title' // "Atividade Recente" (Requirement 8.6)
  | 'profile.timeline.title' // "Linha do Tempo de Atividade" (Requirement 8.7)
  | 'profile.timeline.firstRating'
  | 'profile.timeline.achievementUnlocked'
  | 'profile.timeline.levelUp'
  | 'profile.timeline.empty'
  | 'profile.empty.noActivity'
  | 'profile.guard.loginRequired' // "Você precisa estar logado para ver seu perfil." (Requirement 8.10)
  | 'profile.loadError' // profile could not be loaded
  | 'profile.level.label' // "Nível de Torcedor" (Requirement 8.3)
  | 'profile.fanScore.pointsToNext' // "{points} pontos para o nível {level}" (Requirement 9.6)
  | 'profile.fanScore.maxLevel' // highest level reached (Requirement 9.6)
  | 'profile.favoritePlayer.none' // no favorite player yet
  | 'profile.achievements.empty' // no achievements in the catalog
  | 'profile.badges.empty' // no badges earned yet

  // -------------------------------------------------------------------------
  // Fan Score & supporter levels (Requirement 9)
  // -------------------------------------------------------------------------
  | 'fanScore.label'
  | 'fanScore.progressToNext'
  | 'fanScore.gain' // visual feedback of a gain (Requirement 9.2), with {points}
  | 'fanScore.levelUp' // recognition notification (Requirement 9.5), with {level}
  | 'level.iniciante'
  | 'level.torcedor'
  | 'level.apaixonado'
  | 'level.especialista'
  | 'level.lenda'

  // -------------------------------------------------------------------------
  // Achievements (Requirement 10)
  // -------------------------------------------------------------------------
  | 'achievements.title'
  | 'achievements.unlocked'
  | 'achievements.pending'
  | 'achievements.unlockedToast' // congratulation notification (Requirement 10.3)
  | 'achievement.firstRating.title' // "Primeira Avaliação"
  | 'achievement.firstRating.desc'
  | 'achievement.tenRatings.title' // "10 Avaliações"
  | 'achievement.tenRatings.desc'
  | 'achievement.hundredRatings.title' // "100 Avaliações"
  | 'achievement.hundredRatings.desc'
  | 'achievement.allBrasileirao.title' // "Avaliou Todos os Jogos do Brasileirão"
  | 'achievement.allBrasileirao.desc'
  | 'achievement.allLibertadores.title' // "Avaliou Todos os Jogos da Libertadores"
  | 'achievement.allLibertadores.desc'
  | 'achievement.goalkeeperExpert.title' // "Especialista em Goleiros"
  | 'achievement.goalkeeperExpert.desc'
  | 'achievement.defenderExpert.title' // "Especialista em Zagueiros"
  | 'achievement.defenderExpert.desc'
  | 'achievement.seasonSupporter.title' // "Torcedor da Temporada"
  | 'achievement.seasonSupporter.desc'
  | 'achievement.communityVeteran.title' // "Veterano da Comunidade"
  | 'achievement.communityVeteran.desc'

  // -------------------------------------------------------------------------
  // Home page sections (Requirement 11)
  // -------------------------------------------------------------------------
  | 'home.hero.title'
  | 'home.hero.subtitle'
  | 'home.lastMatch.title' // "Última Partida" (Requirement 11.3)
  | 'home.playerOfWeek.title' // "Jogador da Semana" (Requirement 11.4)
  | 'home.teamOfMonth.title' // "Time da Comunidade do Mês" (Requirement 11.5)
  | 'home.teamOfMonth.seeFull'
  | 'home.topPlayers.title' // "Melhores Jogadores" (Requirement 11.6)
  | 'home.nextMatch.title' // "Próxima Partida" (Requirement 11.7)
  | 'home.nextMatch.live' // "O jogo está acontecendo agora!" (Requirement 11.8)
  | 'home.communityActivity.title' // "Atividade da Comunidade" (Requirement 11.9)
  | 'home.trendingPlayers.title' // "Jogadores em Alta" (Requirement 11.9)
  | 'home.latestRatings.title' // "Últimas Avaliações" (Requirement 11.10)
  | 'home.quickNav.title' // "Navegação Rápida" (Requirement 11.11)
  | 'home.quickNav.squad'
  | 'home.quickNav.matches'
  | 'home.quickNav.rankings'
  | 'home.quickNav.rate'

  // -------------------------------------------------------------------------
  // Countdown segment labels (Requirement 11.7)
  // -------------------------------------------------------------------------
  | 'countdown.days'
  | 'countdown.hours'
  | 'countdown.minutes'
  | 'countdown.seconds'

  // -------------------------------------------------------------------------
  // Router / 404 / guards / toasts (Requirements 12, 31)
  // -------------------------------------------------------------------------
  | 'notFound.page.title' // "Página não encontrada" (Requirement 12.5)
  | 'notFound.player.title' // "Jogador não encontrado" (Requirement 16.14)
  | 'notFound.match.title' // "Partida não encontrada" (Requirement 19.11)
  | 'notFound.backHome'
  | 'guard.adminOnly' // "Acesso restrito a administradores." (Requirement 12.6)
  | 'guard.authRequired' // explanatory login message (Requirement 12.7)
  | 'toast.batchPartialSuccess' // partial batch success (Requirement 31.3)

  // -------------------------------------------------------------------------
  // Global search (Requirement 13)
  // -------------------------------------------------------------------------
  | 'search.placeholder'
  | 'search.category.players'
  | 'search.category.matches'
  | 'search.category.competitions'
  | 'search.noResults' // "Nenhum resultado para '{term}'" (Requirement 13.8)
  | 'search.hint'

  // -------------------------------------------------------------------------
  // Filters (Requirement 14)
  // -------------------------------------------------------------------------
  | 'filter.position'
  | 'filter.competition'
  | 'filter.all'
  | 'filter.clear'
  | 'filter.sortBy'

  // -------------------------------------------------------------------------
  // Positions & competitions (labels)
  // -------------------------------------------------------------------------
  | 'position.goalkeeper'
  | 'position.defender'
  | 'position.midfielder'
  | 'position.attacker'
  | 'position.goalkeeper.abbr'
  | 'position.defender.abbr'
  | 'position.midfielder.abbr'
  | 'position.attacker.abbr'
  | 'competition.serieA'
  | 'competition.copaDoBrasil'
  | 'competition.libertadores'
  | 'competition.mineiro'
  | 'competition.friendly'

  // -------------------------------------------------------------------------
  // Squad / Elenco (Requirement 15)
  // -------------------------------------------------------------------------
  | 'squad.title'
  | 'squad.subtitle'
  | 'squad.empty' // empty state (Requirement 15.10)
  | 'squad.loadError' // "Não foi possível carregar o elenco" (Requirement 15.10)
  | 'squad.noResults' // no players match the active filters (Requirement 14.7)
  | 'squad.sort.rating'
  | 'squad.sort.position'
  | 'squad.sort.name'
  | 'squad.filter.position.all' // "Todos" (Requirement 15.5)
  | 'squad.filter.position.goalkeepers' // "Goleiros" (Requirement 15.5)
  | 'squad.filter.position.defenders' // "Defensores" (Requirement 15.5)
  | 'squad.filter.position.midfielders' // "Meias" (Requirement 15.5)
  | 'squad.filter.position.attackers' // "Atacantes" (Requirement 15.5)
  | 'squad.filter.minVotes' // minimum votes filter label (Requirement 14.3)
  | 'squad.filter.minVotesAny' // "Sem filtro" votes option (Requirement 14.3)
  | 'squad.filter.minVotesAtLeast' // "≥ {count}" votes option (Requirement 14.3)
  | 'squad.filter.ratingRange' // season-average range label (Requirement 14.2)
  | 'squad.filter.resultCount' // "{count} jogadores" (Requirement 14.7)

  // -------------------------------------------------------------------------
  // Player profile / scouting report (Requirement 16)
  // -------------------------------------------------------------------------
  | 'player.seasonSummary.title'
  | 'player.seasonSummary.matches' // "Partidas Avaliadas" (Requirement 16.4)
  | 'player.seasonAverage'
  | 'player.radar.title' // "Perfil de Atributos" (Requirement 16.3)
  | 'player.radar.axis.average'
  | 'player.radar.axis.peak'
  | 'player.radar.axis.floor'
  | 'player.radar.axis.recent'
  | 'player.radar.axis.consistency'
  | 'player.strengths.title'
  | 'player.weaknesses.title'
  | 'player.trend.title'
  | 'player.trend.up'
  | 'player.trend.down'
  | 'player.trend.stable'
  | 'player.recentForm.title'
  | 'player.recentForm.empty' // no rated matches yet (Requirement 16.7)
  | 'player.evolution.title'
  | 'player.evolution.insufficient' // insufficient points (Requirement 16.8)
  | 'player.byCompetition.title'
  | 'player.histogram.title'
  | 'player.votes'
  | 'player.rating'
  | 'player.permanentScore.title' // Nota_Permanente (Requirement 21)
  | 'player.permanentScore.scoreLabel' // yearly rating field label (Requirement 21.1)
  | 'player.permanentScore.average' // community permanent average (Requirement 21.5)
  | 'player.permanentScore.yourScore' // "Sua nota" (Requirement 21.6)
  | 'player.permanentScore.submit'
  | 'player.permanentScore.success' // confirmation after submitting (Requirement 21.3)
  | 'player.permanentScore.loginRequired' // visitor must log in to rate
  | 'player.permanentScore.alreadyRated' // "Você já avaliou este jogador este ano" (Requirement 21.4)

  // -------------------------------------------------------------------------
  // Player comparison (Requirement 17)
  // -------------------------------------------------------------------------
  | 'compare.title'
  | 'compare.subtitle'
  | 'compare.selectFirst'
  | 'compare.selectSecond'
  | 'compare.selectPrompt' // prompt shown until two players are chosen (Requirement 17.1)
  | 'compare.loadError' // data could not be loaded for the comparison
  | 'compare.winner' // highlighted winner per metric (Requirement 17.5)
  | 'compare.metric.insufficient' // "Dados insuficientes" per missing metric
  | 'compare.overview.title' // side-by-side player overview (Requirement 17.2)
  | 'compare.radar.title' // overlaid attribute radar (Requirement 17.3)
  | 'compare.evolution.title' // comparative evolution lines (Requirement 17.4)
  | 'compare.stats.title' // comparative statistics panel (Requirement 17.5)
  | 'compare.byCompetition.title' // per-competition comparison (Requirement 17.2)
  | 'compare.metric.bestMatch' // best match average metric
  | 'compare.metric.worstMatch' // worst match average metric
  | 'compare.metric.recentForm' // recent-form average metric
  | 'compare.metric.consistency' // regularity (inverse std-dev) metric
  | 'compare.axis.average' // radar axis: season average
  | 'compare.axis.best' // radar axis: peak
  | 'compare.axis.worst' // radar axis: floor
  | 'compare.axis.consistency' // radar axis: regularity
  | 'compare.axis.form' // radar axis: recent form

  // -------------------------------------------------------------------------
  // Matches (Requirements 19)
  // -------------------------------------------------------------------------
  | 'matches.title'
  | 'matches.tab.upcoming' // "Próximos"
  | 'matches.tab.past' // "Anteriores"
  | 'match.score'
  | 'match.stadium'
  | 'match.status.notstarted'
  | 'match.status.inprogress'
  | 'match.status.finished'
  | 'match.status.postponed'
  | 'match.lineup.title'
  | 'match.bestPlayer'
  | 'match.worstPlayer'
  | 'match.averageScore'
  | 'match.participation'
  | 'match.action.rate'
  | 'match.action.editRating'

  // -------------------------------------------------------------------------
  // Rankings (Requirement 26)
  // -------------------------------------------------------------------------
  | 'rankings.title'
  | 'rankings.category.overall'
  | 'rankings.category.mostConsistent'
  | 'rankings.category.mostVotes'
  | 'rankings.category.byPosition'
  | 'rankings.bestMatch' // "Partida Mais Bem Avaliada"
  | 'rankings.searchByName'

  // -------------------------------------------------------------------------
  // Team of the Month (Requirement 25)
  // -------------------------------------------------------------------------
  | 'teamOfMonth.title'
  | 'teamOfMonth.subtitle'
  | 'teamOfMonth.selectMonth'
  | 'teamOfMonth.selectCompetition'
  | 'teamOfMonth.allCompetitions' // "Todas as competições" (Requirement 25.1)
  | 'teamOfMonth.stats.title'
  | 'teamOfMonth.stats.teamAverage' // "Nota média do time" (Requirement 25.4)
  | 'teamOfMonth.stats.totalVotes'
  | 'teamOfMonth.stats.selectedPlayers'
  | 'teamOfMonth.insufficient' // "Dados insuficientes para montar o time deste período" (Requirement 25.6)
  | 'teamOfMonth.loadError'
  | 'teamOfMonth.share'

  // -------------------------------------------------------------------------
  // Collections (Requirement 18)
  // -------------------------------------------------------------------------
  | 'collections.title'
  | 'collections.progress' // explored progress, with {explored}/{total}
  | 'collections.incomplete'
  | 'collection.goalkeepers.title'
  | 'collection.defenders.title'
  | 'collection.legendary.title'
  | 'collection.season.title'
  | 'collection.libertadores.title'

  // -------------------------------------------------------------------------
  // Rate a match (Requirement 20)
  // -------------------------------------------------------------------------
  | 'rate.title'
  | 'rate.instructions'
  | 'rate.scoreLabel'
  | 'rate.submit'
  | 'rate.submitting'
  | 'rate.success'
  | 'rate.error' // error keeps form open, re-enables button (Requirement 20.7)
  | 'rate.notReleased' // fixture not released for rating

  // -------------------------------------------------------------------------
  // Craque da Partida — Man of the Match (Requirement 22)
  // -------------------------------------------------------------------------
  | 'craque.title'
  | 'craque.vote'
  | 'craque.voted'
  | 'craque.result' // most voted player (Requirement 22.4)
  | 'craque.votes'

  // -------------------------------------------------------------------------
  // Palpite — pre-match prediction (Requirement 23)
  // -------------------------------------------------------------------------
  | 'prediction.title'
  | 'prediction.scoreLabel'
  | 'prediction.lineupLabel'
  | 'prediction.submit'
  | 'prediction.locked' // blocked after kickoff (Requirement 23.2)
  | 'prediction.result.exactScore'
  | 'prediction.result.correctResult'
  | 'prediction.result.points'

  // -------------------------------------------------------------------------
  // Admin panel (Requirement 28)
  // -------------------------------------------------------------------------
  | 'admin.title'
  | 'admin.subtitle'
  | 'admin.tab.users' // tab navigation (Requirement 28.1)
  | 'admin.tab.squad'
  | 'admin.tab.fixtures'
  | 'admin.actionFailed' // generic write-failure toast
  | 'admin.users.title'
  | 'admin.users.subtitle'
  | 'admin.users.approve'
  | 'admin.users.reject'
  | 'admin.users.promote'
  | 'admin.users.demote'
  | 'admin.users.cannotDemoteSelf' // prevent self-demotion (Requirement 28.11)
  | 'admin.users.colUser' // user-list columns (Requirement 28.1)
  | 'admin.users.colEmail'
  | 'admin.users.colStatus'
  | 'admin.users.colRole'
  | 'admin.users.colCreated'
  | 'admin.users.colActions'
  | 'admin.users.roleUser'
  | 'admin.users.roleAdmin'
  | 'admin.users.statusPending'
  | 'admin.users.statusApproved'
  | 'admin.users.statusRejected'
  | 'admin.users.empty'
  | 'admin.users.loadError'
  | 'admin.users.statusUpdated' // approve/reject feedback (Requirement 28.2)
  | 'admin.users.roleUpdated' // promote/demote feedback (Requirement 28.1)
  | 'admin.squad.title'
  | 'admin.squad.subtitle'
  | 'admin.squad.empty'
  | 'admin.squad.loadError'
  | 'admin.squad.addTitle' // manual add form (Requirement 28.10)
  | 'admin.squad.editTitle'
  | 'admin.squad.colName'
  | 'admin.squad.colPosition'
  | 'admin.squad.colNumber'
  | 'admin.squad.colActions'
  | 'admin.squad.field.id'
  | 'admin.squad.field.name'
  | 'admin.squad.field.position'
  | 'admin.squad.field.number'
  | 'admin.squad.field.nationality'
  | 'admin.squad.field.photo'
  | 'admin.squad.required.id' // per-field validation messages (Requirement 28.10)
  | 'admin.squad.required.name'
  | 'admin.squad.required.position'
  | 'admin.squad.added'
  | 'admin.squad.updated'
  | 'admin.squad.deleted'
  | 'admin.squad.deleteTitle' // delete confirmation modal (Requirement 28.3)
  | 'admin.squad.deleteConfirm' // "Excluir {name}?" with player name
  | 'admin.fixtures.title'
  | 'admin.fixtures.subtitle'
  | 'admin.fixtures.empty'
  | 'admin.fixtures.loadError'
  | 'admin.fixtures.toggleReleased' // flag liberado (Requirement 28.8)
  | 'admin.fixtures.released'
  | 'admin.fixtures.notReleased'
  | 'admin.fixtures.liberadoOn' // liberado enabled toast (Requirement 28.8)
  | 'admin.fixtures.liberadoOff' // liberado disabled toast (Requirement 28.8)
  | 'admin.fixtures.manageLineup'
  | 'admin.lineup.title'
  | 'admin.lineup.editTitle' // lineup editor modal (Requirement 28.7)
  | 'admin.lineup.empty'
  | 'admin.lineup.selected' // "{count} selecionados"
  | 'admin.lineup.saved' // lineup persisted toast (Requirement 28.7)
  | 'admin.lineup.loadError'
  | 'admin.import.title'
  | 'admin.import.invalid'
  | 'admin.import.playersTitle' // squad batch import (Requirement 28.5)
  | 'admin.import.fixturesTitle' // fixtures batch import (Requirement 28.6)
  | 'admin.import.placeholder' // JSON textarea placeholder
  | 'admin.import.submit'
  | 'admin.import.parseError' // malformed JSON
  | 'admin.import.success' // "{count} importados"
  | 'admin.import.partial' // "{succeeded} ok, {failed} falharam" (Requirement 31.5)
  | 'admin.import.rejected' // whole-batch validation rejection (Requirements 28.5, 28.6)
  | 'admin.confirm.title'

  // -------------------------------------------------------------------------
  // Themes (Requirement 4)
  // -------------------------------------------------------------------------
  | 'theme.cruzeiro'
  | 'theme.dark'
  | 'theme.blackGold'
  | 'theme.retro2003'
  | 'theme.libertadores'

  // -------------------------------------------------------------------------
  // PWA / reminders (Requirement 34)
  // -------------------------------------------------------------------------
  | 'pwa.install'
  | 'pwa.reminder.enable'
  | 'pwa.reminder.enabled'
  | 'pwa.reminder.matchSoon';
