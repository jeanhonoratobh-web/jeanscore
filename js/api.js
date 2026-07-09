// =============================================
// JEANSCORE – API
// Elenco: API-Football (via Apps Script proxy)
// Jogos:  cadastro manual pelo Admin
// =============================================

const API = {

  // ─────────────────────────────────────────
  // API-FOOTBALL (elenco via proxy)
  // ─────────────────────────────────────────
  async _footballRequest(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url   = `${CONFIG.API_BASE}${endpoint}?${query}`;
    const cached = cacheGet(url);
    if (cached) return cached;
    try {
      const res = await fetch(url, {
        headers: { 'x-apisports-key': CONFIG.API_KEY }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cacheSet(url, data);
      return data;
    } catch(e) {
      console.error('Erro API-Football:', e);
      return null;
    }
  },

  async getSquad() {
    // Tenta via Apps Script proxy (que busca da planilha Elenco)
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
        console.warn('Proxy squad falhou:', e);
      }
    }
    // Fallback direto: API-Football
    const data = await this._footballRequest('/players/squads', { team: CONFIG.CRUZEIRO_ID });
    if (!data?.response?.length) return [];
    return data.response[0].players.map(p => ({
      ...p,
      photo: p.photo || `https://media.api-sports.io/football/players/${p.id}.png`,
    })) || [];
  },

  // ─────────────────────────────────────────
  // JOGOS MANUAIS (localStorage + Sheets)
  // ─────────────────────────────────────────

  getAllFixtures() {
    const jogos = this._getManualJogos();
    return jogos.map(j => this._jogoToFixture(j));
  },

  _getManualJogos() {
    try { return JSON.parse(localStorage.getItem('js_manualJogos') || '[]'); }
    catch { return []; }
  },

  _jogoToFixture(j) {
    const leagueInfo = CONFIG.COMPETITIONS[j.leagueId] || {};
    return {
      id:            j.id,
      homeTeam:      { name: j.home, id: null, logo: '' },
      awayTeam:      { name: j.away, id: null, logo: '' },
      homeScore:     { current: j.homeScore ?? null },
      awayScore:     { current: j.awayScore ?? null },
      status:        { type: j.status || 'notstarted' },
      startTimestamp: j.timestamp,
      tournament:    { name: leagueInfo.name || j.leagueName || '', id: j.leagueId },
      _leagueId:     j.leagueId,
      _manual:       true,
      _liberado:     j.liberado || false,
    };
  },

  // Escalação de um jogo (localStorage)
  async getLineup(fixtureId) {
    try {
      const escalacoes = JSON.parse(localStorage.getItem('js_escalacoes') || '{}');
      const playerIds  = escalacoes[String(fixtureId)];
      if (playerIds && playerIds.length > 0) {
        const squad = window.APP?.squad || [];
        const participated = playerIds.map(id => {
          const p = squad.find(s => String(s.id) === String(id));
          return p ? { id: p.id, name: p.name, pos: p.position, played: true, starter: true } : null;
        }).filter(Boolean);
        if (participated.length > 0) return { participated, all: participated };
      }
    } catch(e) {}
    return { participated: [], all: [] };
  },

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  formatStatus(fixture) {
    const type = fixture.status?.type || '';
    if (type === 'finished')    return { label: 'Encerrado', css: 'status-ft',   done: true,  live: false };
    if (type === 'notstarted')  return { label: 'Agendado',  css: 'status-ns',   done: false, live: false };
    if (type === 'inprogress')  return { label: 'AO VIVO',   css: 'status-live', done: false, live: true  };
    if (type === 'postponed')   return { label: 'Adiado',    css: 'status-ft',   done: false, live: false };
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
      hour: '2-digit', minute: '2-digit'
    });
  },
};
