// =============================================
// JEANSCORE – INTEGRAÇÃO APIs
// Elenco:           API-Football
// Jogos/Escalações: SofaScore (API interna)
// =============================================

const API = {

  // ─────────────────────────────────────────
  // API-FOOTBALL (elenco)
  // ─────────────────────────────────────────
  async _footballRequest(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${CONFIG.API_BASE}${endpoint}?${query}`;
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
    } catch (err) {
      console.error('Erro API-Football:', err);
      return null;
    }
  },

  async getSquad() {
    // Elenco via Apps Script proxy (tenta SofaScore, fallback API-Football)
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
    // Fallback direto: API-Football (funciona no browser)
    const data = await this._footballRequest('/players/squads', { team: CONFIG.CRUZEIRO_ID });
    if (!data?.response?.length) return [];
    // Mapeia para o mesmo formato e usa foto do SofaScore pelo nome
    return data.response[0].players.map(p => ({
      ...p,
      photo: `https://media.api-sports.io/football/players/${p.id}.png`,
    })) || [];
  },

  // ─────────────────────────────────────────
  // SOFASCORE (jogos, escalações, eventos)
  // ─────────────────────────────────────────
  SOFA_BASE: 'https://api.sofascore.com/api/v1',
  SOFA_HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.sofascore.com/',
  },

  async _sofaRequest(path) {
    const url = `${this.SOFA_BASE}${path}`;
    const cached = cacheGet(url);
    if (cached) return cached;
    try {
      const res = await fetch(url, { headers: this.SOFA_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cacheSet(url, data);
      return data;
    } catch (err) {
      console.error('Erro SofaScore:', err);
      return null;
    }
  },

  // Últimos jogos (página 0 = últimos 10, página 1 = 10 anteriores...)
  async getLastFixtures(page = 0) {
    const data = await this._sofaRequest(`/team/${CONFIG.CRUZEIRO_SOFA_ID}/events/last/${page}`);
    return data?.events || [];
  },

  // Próximos jogos
  async getNextFixtures(page = 0) {
    const data = await this._sofaRequest(`/team/${CONFIG.CRUZEIRO_SOFA_ID}/events/next/${page}`);
    return data?.events || [];
  },

  // Todos os jogos (últimos 2 pages + próximos 1 page)
  async getAllFixtures() {
    const [last0, last1, next0] = await Promise.all([
      this.getLastFixtures(0),
      this.getLastFixtures(1),
      this.getNextFixtures(0),
    ]);
    const all = [...last1, ...last0, ...next0];
    // Remove duplicatas por ID
    const seen = new Set();
    return all.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  },

  // Escalação de um jogo específico
  async getLineup(sofaEventId) {
    const data = await this._sofaRequest(`/event/${sofaEventId}/lineups`);
    if (!data?.home && !data?.away) return null;

    // Descobre qual time é o Cruzeiro
    const cruzTeam = data.home?.team?.name?.toLowerCase().includes('cruzeiro')
      ? data.home : data.away;
    if (!cruzTeam) return null;

    const participated = [];
    const all = [];

    cruzTeam.players?.forEach(p => {
      const player = {
        id:      p.player.id,
        name:    p.player.name,
        pos:     p.player.position || '',
        number:  p.jerseyNumber || '',
        played:  !p.substitute,   // titulares jogaram
        starter: !p.substitute,
      };
      all.push(player);
      if (!p.substitute) participated.push(player);
    });

    // Substitutos que entraram: verificar via statistics ou marcar todos como potencialmente jogados
    cruzTeam.players?.forEach(p => {
      if (p.substitute) {
        const player = all.find(a => a.id === p.player.id);
        if (player) {
          // Se tem estatísticas de minutos jogados, entrou
          const mins = p.statistics?.minutesPlayed;
          if (mins && mins > 0) {
            player.played = true;
            participated.push(player);
          }
        }
      }
    });

    return { participated, all };
  },

  // Converte torneio SofaScore → ID local
  getTournamentId(tournamentName) {
    if (!tournamentName) return null;
    for (const [name, id] of Object.entries(CONFIG.SOFA_TOURNAMENT_MAP)) {
      if (tournamentName.toLowerCase().includes(name.toLowerCase())) return id;
    }
    return null;
  },

  // ── HELPERS ──

  formatStatus(fixture) {
    const type = fixture.status?.type || '';
    if (type === 'finished')   return { label: 'Encerrado', css: 'status-ft',   done: true,  live: false };
    if (type === 'notstarted') return { label: 'Agendado',  css: 'status-ns',   done: false, live: false };
    if (type === 'inprogress') return { label: 'AO VIVO',   css: 'status-live', done: false, live: true  };
    if (type === 'postponed')  return { label: 'Adiado',    css: 'status-ft',   done: false, live: false };
    if (type === 'canceled')   return { label: 'Cancelado', css: 'status-ft',   done: false, live: false };
    return { label: type, css: 'status-ft', done: false, live: false };
  },

  getScore(fixture) {
    const h = fixture.homeScore?.current ?? fixture.homeScore?.display ?? '—';
    const a = fixture.awayScore?.current ?? fixture.awayScore?.display ?? '—';
    return { home: h, away: a };
  },

  compName(fixture) {
    const name = fixture.tournament?.name || fixture.tournament?.uniqueTournament?.name || '';
    const id = this.getTournamentId(name);
    if (id && CONFIG.COMPETITIONS[id]) return CONFIG.COMPETITIONS[id].short;
    return name || 'Outro';
  },

  compFlag(fixture) {
    const name = fixture.tournament?.name || '';
    const id = this.getTournamentId(name);
    if (id && CONFIG.COMPETITIONS[id]) return CONFIG.COMPETITIONS[id].flag;
    return '⚽';
  },

  formatDate(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  },

  isMonitoredComp(fixture) {
    const name = fixture.tournament?.name || '';
    return this.getTournamentId(name) !== null;
  },
};
