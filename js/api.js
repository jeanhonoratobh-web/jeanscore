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

  // ─────────────────────────────────────────
  // ESPN API (jogos — pública, sem chave, CORS OK)
  // ─────────────────────────────────────────
  ESPN_BASE: 'https://site.api.espn.com/apis/site/v2/sports/soccer',
  ESPN_CRUZEIRO_ID: '2022',

  // Competições ESPN → IDs locais
  ESPN_LEAGUE_MAP: {
    'bra.1':  { id: 71,  name: 'Série A',        short: 'Série A',  flag: '🇧🇷' },
    'bra.2':  { id: 73,  name: 'Copa do Brasil',  short: 'Copa BR',  flag: '🇧🇷' },
    'conmebol.libertadores': { id: 13, name: 'Libertadores', short: 'Libertad', flag: '🌎' },
    'bra.mineiro': { id: 629, name: 'Mineiro', short: 'Mineiro', flag: '🇧🇷' },
  },

  ESPN_LEAGUES: ['bra.1', 'conmebol.libertadores', 'bra.2'],

  async _espnRequest(path) {
    const url = `${this.ESPN_BASE}${path}`;
    const cached = cacheGet(url);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cacheSet(url, data);
      return data;
    } catch(e) {
      console.error('Erro ESPN:', e);
      return null;
    }
  },

  async getAllFixtures() {
    const results = await Promise.all(
      this.ESPN_LEAGUES.map(league =>
        this._espnRequest(`/${league}/teams/${this.ESPN_CRUZEIRO_ID}/schedule?season=2026`)
      )
    );

    const all = [];
    const seen = new Set();

    results.forEach((data, i) => {
      const league = this.ESPN_LEAGUES[i];
      const leagueInfo = this.ESPN_LEAGUE_MAP[league] || {};
      if (!data?.events) return;

      data.events.forEach(ev => {
        if (seen.has(ev.id)) return;
        seen.add(ev.id);

        const comp = ev.competitions?.[0];
        if (!comp) return;

        const cruzeiro = comp.competitors?.find(c =>
          c.team?.id === this.ESPN_CRUZEIRO_ID ||
          (c.team?.displayName || '').toLowerCase().includes('cruzeiro')
        );
        const opponent = comp.competitors?.find(c => c !== cruzeiro);

        const isHome = cruzeiro?.homeAway === 'home';
        const homeTeam = isHome ? cruzeiro : opponent;
        const awayTeam = isHome ? opponent : cruzeiro;

        all.push({
          id:         ev.id,
          homeTeam:   { name: homeTeam?.team?.displayName || '?', id: homeTeam?.team?.id, logo: homeTeam?.team?.logo },
          awayTeam:   { name: awayTeam?.team?.displayName || '?', id: awayTeam?.team?.id, logo: awayTeam?.team?.logo },
          homeScore:  { current: homeTeam?.score ?? null },
          awayScore:  { current: awayTeam?.score ?? null },
          status:     { type: this._espnStatusToSofa(ev.status?.type?.name) },
          startTimestamp: Math.floor(new Date(ev.date).getTime() / 1000),
          tournament: { name: leagueInfo.name || league, id: leagueInfo.id },
          _leagueId:  leagueInfo.id,
        });
      });
    });

    return all.sort((a, b) => a.startTimestamp - b.startTimestamp);
  },

  _espnStatusToSofa(espnStatus) {
    if (!espnStatus) return 'notstarted';
    const s = espnStatus.toLowerCase();
    if (s.includes('final') || s.includes('ft') || s.includes('full')) return 'finished';
    if (s.includes('progress') || s.includes('live') || s.includes('half')) return 'inprogress';
    if (s.includes('postponed')) return 'postponed';
    return 'notstarted';
  },

  async getLineup(fixtureId) {
    // ESPN não tem escalação detalhada gratuita — usa Apps Script se disponível
    if (isSheetsConfigured()) {
      try {
        const res = await fetch(CONFIG.SHEETS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'getLineup', fixtureId }),
        });
        const data = await res.json();
        if (data.ok) return { participated: data.participated || [], all: data.all || [] };
      } catch(e) {}
    }
    return { participated: [], all: [] };
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
    return fixture.tournament?.name || fixture.tournament?.short || 'Outro';
  },

  compFlag(fixture) {
    const id = fixture._leagueId || fixture.tournament?.id;
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
