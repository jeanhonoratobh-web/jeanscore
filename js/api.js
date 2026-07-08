// =============================================
// JEANSCORE – INTEGRAÇÃO API-FOOTBALL
// =============================================

const API = {

  // Requisição base com cache
  async request(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${CONFIG.API_BASE}${endpoint}?${query}`;
    const cacheKey = url;

    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(url, {
        headers: {
          'x-apisports-key': CONFIG.API_KEY,
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error('API Error:', data.errors);
        return null;
      }

      cacheSet(cacheKey, data);
      return data;
    } catch (err) {
      console.error('Erro na API-Football:', err);
      return null;
    }
  },

  // ── ELENCO ──
  async getSquad() {
    const data = await this.request('/players/squads', {
      team: CONFIG.CRUZEIRO_ID
    });
    if (!data || !data.response || !data.response.length) return [];
    return data.response[0].players || [];
  },

  // ── JOGOS ──
  async getFixtures(leagueId) {
    const data = await this.request('/fixtures', {
      team:   CONFIG.CRUZEIRO_ID,
      league: leagueId,
      season: CONFIG.SEASON,
    });
    if (!data || !data.response) return [];
    return data.response;
  },

  async getAllFixtures() {
    const ids = Object.keys(CONFIG.COMPETITIONS);
    const results = await Promise.all(ids.map(id => this.getFixtures(id)));
    const all = results.flat();
    // Ordena por data
    all.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    return all;
  },

  // Jogo ao vivo
  async getLiveFixtures() {
    const data = await this.request('/fixtures', {
      team: CONFIG.CRUZEIRO_ID,
      live: 'all',
    });
    if (!data || !data.response) return [];
    return data.response;
  },

  // ── ESCALAÇÃO DE UM JOGO ──
  async getLineup(fixtureId) {
    const data = await this.request('/fixtures/lineups', {
      fixture: fixtureId,
    });
    if (!data || !data.response) return null;
    // Retorna apenas o lineup do Cruzeiro
    return data.response.find(t => t.team.id === CONFIG.CRUZEIRO_ID) || null;
  },

  // ── ESTATÍSTICAS DE UM JOGO ──
  async getFixtureStats(fixtureId) {
    const data = await this.request('/fixtures/players', {
      fixture: fixtureId,
      team: CONFIG.CRUZEIRO_ID,
    });
    if (!data || !data.response) return [];
    const team = data.response.find(t => t.team.id === CONFIG.CRUZEIRO_ID);
    return team ? team.players : [];
  },

  // ── JOGADORES QUE PARTICIPARAM DE UM JOGO ──
  // Retorna array de player IDs que jogaram (titulares + substitutos que entraram)
  async getParticipants(fixtureId) {
    const lineup = await this.getLineup(fixtureId);
    if (!lineup) return { participated: [], all: [] };

    const starters = lineup.startXI.map(p => ({
      id:       p.player.id,
      name:     p.player.name,
      number:   p.player.number,
      pos:      p.player.pos,
      played:   true,
      starter:  true,
    }));

    const subs = lineup.substitutes.map(p => ({
      id:       p.player.id,
      name:     p.player.name,
      number:   p.player.number,
      pos:      p.player.pos,
      played:   false, // será atualizado abaixo
      starter:  false,
    }));

    // Busca eventos para ver quem realmente entrou
    const eventsData = await this.request('/fixtures/events', {
      fixture: fixtureId,
      team:    CONFIG.CRUZEIRO_ID,
      type:    'subst',
    });

    const subIn = new Set();
    if (eventsData && eventsData.response) {
      eventsData.response.forEach(ev => {
        if (ev.team.id === CONFIG.CRUZEIRO_ID && ev.assist && ev.assist.id) {
          subIn.add(ev.assist.id); // "assist" = jogador que entrou
        }
      });
    }

    subs.forEach(p => { if (subIn.has(p.id)) p.played = true; });

    const all = [...starters, ...subs];
    const participated = all.filter(p => p.played);
    return { participated, all };
  },

  // ── HELPER: formata status do jogo ──
  formatStatus(fixture) {
    const s = fixture.fixture.status.short;
    if (['FT','AET','PEN'].includes(s)) return { label: 'Encerrado', css: 'status-ft', done: true };
    if (['NS','TBD'].includes(s))       return { label: 'Agendado',  css: 'status-ns', done: false };
    if (['1H','HT','2H','ET','BT','P'].includes(s)) return { label: 'AO VIVO', css: 'status-live', done: false, live: true };
    return { label: s, css: 'status-ft', done: false };
  },

  // ── HELPER: nome curto da competição ──
  compName(leagueId) {
    const comp = CONFIG.COMPETITIONS[leagueId];
    return comp ? comp.short : 'Outro';
  },

  // ── HELPER: formata data ──
  formatDate(isoDate) {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  },
};
