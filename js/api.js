// =============================================
// JEANSCORE – API
// Elenco:  Supabase → table: squad
// Jogos:   Supabase → table: fixtures  (+manual localStorage)
// Escalações: Supabase → table: escalacoes
// =============================================

const API = {

  // ─────────────────────────────────────────
  // SQUAD
  // ─────────────────────────────────────────
  async getSquad() {
    const r = await SUPA.getSquad();
    if (r.ok && r.players?.length) return r.players;
    // fallback: localStorage cache
    try {
      const cached = JSON.parse(localStorage.getItem('js_squad_cache') || '[]');
      if (cached.length) return cached;
    } catch(e) {}
    return [];
  },

  // ─────────────────────────────────────────
  // FIXTURES
  // ─────────────────────────────────────────
  getAllFixtures() {
    const manual = this._getManualJogos();
    return manual.map(j => this._jogoToFixture(j));
  },

  async getAllFixturesAsync() {
    const r = await SUPA.getFixtures();
    if (r.ok && r.jogos?.length) {
      const supaIds = new Set(r.jogos.map(j => j.id));
      const manual  = this._getManualJogos().filter(j => !supaIds.has(j.id));
      const all     = [
        ...r.jogos.map(j => this._supaJogoToFixture(j)),
        ...manual.map(j => this._jogoToFixture(j)),
      ];
      return all.sort((a, b) => a.startTimestamp - b.startTimestamp);
    }
    return this.getAllFixtures();
  },

  _supaJogoToFixture(j) {
    const leagueId   = this._compNameToId(j.comp);
    const leagueInfo = CONFIG.COMPETITIONS[leagueId] || {};
    return {
      id:             j.id,
      homeTeam:       { name: j.home,  id: null, logo: '' },
      awayTeam:       { name: j.away,  id: null, logo: '' },
      homeScore:      { current: j.homeScore ?? null },
      awayScore:      { current: j.awayScore ?? null },
      status:         { type: j.status || 'notstarted' },
      startTimestamp: j.timestamp || 0,
      tournament:     { name: j.comp || leagueInfo.name || '', id: leagueId },
      _leagueId:      leagueId,
      _manual:        true,
      _liberado:      j.liberado || false,
      _stadium:       j.stadium || '',
    };
  },

  _compNameToId(compName) {
    if (!compName) return 999;
    const n = compName.toLowerCase();
    if (n.includes('mineiro'))                                               return 629;
    if (n.includes('brasileiro') || n.includes('série a') || n.includes('serie a')) return 71;
    if (n.includes('copa do brasil'))                                        return 73;
    if (n.includes('libertadores'))                                          return 13;
    return 999;
  },

  _getManualJogos() {
    try { return JSON.parse(localStorage.getItem('js_manualJogos') || '[]'); }
    catch { return []; }
  },

  _jogoToFixture(j) {
    const leagueInfo = CONFIG.COMPETITIONS[j.leagueId] || {};
    return {
      id:             j.id,
      homeTeam:       { name: j.home, id: null, logo: '' },
      awayTeam:       { name: j.away, id: null, logo: '' },
      homeScore:      { current: j.homeScore ?? null },
      awayScore:      { current: j.awayScore ?? null },
      status:         { type: j.status || 'notstarted' },
      startTimestamp: j.timestamp,
      tournament:     { name: leagueInfo.name || j.leagueName || '', id: j.leagueId },
      _leagueId:      j.leagueId,
      _manual:        true,
      _liberado:      j.liberado || false,
    };
  },

  // ─────────────────────────────────────────
  // ESCALAÇÕES (Supabase + localStorage fallback)
  // ─────────────────────────────────────────
  async getLineup(fixtureId) {
    // Try Supabase first
    const r = await SUPA.getEscalacao(String(fixtureId));
    if (r.ok && r.playerIds?.length) {
      const squad = (typeof APP !== 'undefined' && APP.squad?.length) ? APP.squad : [];
      const participated = r.playerIds
        .map(id => squad.find(s => String(s.id) === String(id)))
        .filter(Boolean)
        .map(p => ({ id: p.id, name: p.name, pos: p.position, played: true, starter: true }));
      if (participated.length) return { participated, all: participated };
    }
    // Fallback: localStorage
    try {
      const escalacoes = JSON.parse(localStorage.getItem('js_escalacoes') || '{}');
      const playerIds  = escalacoes[String(fixtureId)];
      if (playerIds?.length) {
        const squad = (typeof APP !== 'undefined' && APP.squad?.length) ? APP.squad : [];
        const participated = playerIds
          .map(id => squad.find(s => String(s.id) === String(id)))
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, pos: p.position, played: true, starter: true }));
        if (participated.length) return { participated, all: participated };
      }
    } catch(e) {}
    return { participated: [], all: [] };
  },

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────
  formatStatus(fixture) {
    const type = fixture.status?.type || '';
    if (type === 'finished')   return { label: 'Encerrado', css: 'status-ft',   done: true,  live: false };
    if (type === 'notstarted') return { label: 'Agendado',  css: 'status-ns',   done: false, live: false };
    if (type === 'inprogress') return { label: 'AO VIVO',   css: 'status-live', done: false, live: true  };
    if (type === 'postponed')  return { label: 'Adiado',    css: 'status-ft',   done: false, live: false };
    return { label: 'Agendado', css: 'status-ns', done: false, live: false };
  },

  getScore(fixture) {
    const h = fixture.homeScore?.current;
    const a = fixture.awayScore?.current;
    return {
      home: h !== null && h !== undefined ? h : '—',
      away: a !== null && a !== undefined ? a : '—',
    };
  },

  compName(fixture) {
    const id = fixture._leagueId || fixture.tournament?.id;
    return CONFIG.COMPETITIONS[id]?.short || fixture.tournament?.name || 'Outro';
  },

  compFlag(fixture) {
    const id = fixture._leagueId || fixture.tournament?.id;
    return CONFIG.COMPETITIONS[id]?.flag || '⚽';
  },

  isMonitoredComp(fixture) {
    if (fixture._manual) return true;
    const id = fixture._leagueId || fixture.tournament?.id;
    return !!CONFIG.COMPETITIONS[id];
  },

  getTournamentId(name) {
    if (!name) return null;
    for (const [id, comp] of Object.entries(CONFIG.COMPETITIONS)) {
      if (name.toLowerCase().includes(comp.name.toLowerCase()) ||
          name.toLowerCase().includes(comp.short.toLowerCase())) return parseInt(id);
    }
    return null;
  },

  formatDate(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  },
};
