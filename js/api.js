// =============================================
// JEANSCORE – API
// Elenco: cruzeiro.com.br (via Apps Script → planilha Elenco)
// Jogos:  temporada 2026 (via Apps Script → planilha Jogos2026) + manuais
// =============================================

const API = {

  // ─────────────────────────────────────────
  // ELENCO (via Apps Script proxy)
  // ─────────────────────────────────────────
  async getSquad() {
    if (isSheetsConfigured()) {
      try {
        const res = await fetch(CONFIG.SHEETS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'getSquad' }),
        });
        const data = await res.json();
        if (data.ok && data.players?.length) return data.players;
      } catch(e) {
        console.warn('getSquad falhou:', e);
      }
    }
    return [];
  },

  // ─────────────────────────────────────────
  // JOGOS (Sheets + manuais do localStorage)
  // ─────────────────────────────────────────

  getAllFixtures() {
    const manual = this._getManualJogos();
    return manual.map(j => this._jogoToFixture(j));
  },

  async getAllFixturesAsync() {
    if (isSheetsConfigured()) {
      try {
        const res = await fetch(CONFIG.SHEETS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'getFixtures' }),
        });
        const data = await res.json();
        if (data.ok && data.jogos?.length) {
          const sheetsIds = new Set(data.jogos.map(j => j.id));
          const manual    = this._getManualJogos().filter(j => !sheetsIds.has(j.id));
          const all       = [
            ...data.jogos.map(j => this._sheetsJogoToFixture(j)),
            ...manual.map(j => this._jogoToFixture(j)),
          ];
          return all.sort((a, b) => a.startTimestamp - b.startTimestamp);
        }
      } catch(e) {
        console.warn('Sheets fixtures falhou:', e);
      }
    }
    return this.getAllFixtures();
  },

  _sheetsJogoToFixture(j) {
    const leagueId   = this._compNameToId(j.comp);
    const leagueInfo = CONFIG.COMPETITIONS[leagueId] || {};
    return {
      id:             j.id,
      homeTeam:       { name: j.home,  id: null, logo: '' },
      awayTeam:       { name: j.away,  id: null, logo: '' },
      homeScore:      { current: j.homeScore },
      awayScore:      { current: j.awayScore },
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
    if (n.includes('mineiro'))                                         return 629;
    if (n.includes('brasileiro') || n.includes('série a') || n.includes('serie a')) return 71;
    if (n.includes('copa do brasil'))                                  return 73;
    if (n.includes('libertadores'))                                    return 13;
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
  // ESCALAÇÃO (localStorage)
  // ─────────────────────────────────────────
  async getLineup(fixtureId) {
    try {
      const escalacoes = JSON.parse(localStorage.getItem('js_escalacoes') || '{}');
      const playerIds  = escalacoes[String(fixtureId)];
      if (playerIds?.length) {
        const squad = (typeof APP !== 'undefined' && APP.squad?.length) ? APP.squad : [];
        if (!squad.length) {
          return { participated: playerIds.map(id => ({ id, name: '', pos: '', played: true, starter: true })), all: [] };
        }
        const participated = playerIds
          .map(id => squad.find(s => String(s.id) === String(id)))
          .filter(Boolean)
          .map(p => ({ id: p.id, name: p.name, pos: p.position, played: true, starter: true }));
        if (participated.length) return { participated, all: participated };
      }
    } catch(e) { console.error('getLineup error:', e); }
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
