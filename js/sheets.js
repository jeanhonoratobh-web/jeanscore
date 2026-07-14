// =============================================
// JEANSCORE – INTEGRAÇÃO GOOGLE SHEETS
// Via Google Apps Script como REST API
// =============================================

const SHEETS = {

  // Requisição base para o Apps Script
  async request(action, payload = {}) {
    const url = CONFIG.SHEETS_API_URL;
    if (url.includes('SEU_DEPLOYMENT_ID_AQUI')) {
      console.warn('SHEETS: URL do Apps Script não configurada.');
      return { ok: false, error: 'Sheets não configurado' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },  // Apps Script aceita text/plain para evitar CORS preflight
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Erro no Sheets:', err);
      return { ok: false, error: err.message };
    }
  },

  // ── USUÁRIOS ──

  async getUsers() {
    return await this.request('getUsers');
  },

  async registerUser(username, email, passHash) {
    return await this.request('registerUser', { username, email, passHash });
  },

  async loginUser(username, passHash) {
    return await this.request('loginUser', { username, passHash });
  },

  async approveUser(username) {
    return await this.request('approveUser', { username });
  },

  async rejectUser(username) {
    return await this.request('rejectUser', { username });
  },

  // ── NOTAS PRINCIPAIS ──

  async getMainScores() {
    return await this.request('getMainScores');
  },

  async setMainScore(playerId, playerName, score, setBy) {
    return await this.request('setMainScore', { playerId, playerName, score, setBy });
  },

  // ── NOTAS POR JOGO ──

  async getGameScores(fixtureId) {
    return await this.request('getGameScores', { fixtureId });
  },

  async submitGameScore(fixtureId, fixtureDate, homeTeam, awayTeam, playerId, playerName, username, score) {
    return await this.request('submitGameScore', {
      fixtureId, fixtureDate, homeTeam, awayTeam,
      playerId, playerName, username, score
    });
  },

  async getUserGameScores(fixtureId, username) {
    return await this.request('getUserGameScores', { fixtureId, username });
  },

  // ── Sincroniza notas do Sheets para localStorage ──
  async syncGameScores() {
    try {
      // Busca todas as notas do Sheets (sem filtro de fixtureId)
      const res = await this.request('getAllGameScores');
      if (!res.ok || !res.scores) return;

      // Reconstrói o formato do localStorage
      const gs = {};
      res.scores.forEach(s => {
        if (!gs[s.fixtureId]) gs[s.fixtureId] = {};
        if (!gs[s.fixtureId][s.playerId]) gs[s.fixtureId][s.playerId] = {};
        gs[s.fixtureId][s.playerId][s.username] = parseFloat(s.score);
      });

      localStorage.setItem('js_gameScores', JSON.stringify(gs));
      console.log('Notas sincronizadas do Sheets:', res.scores.length);
    } catch(e) {
      console.warn('Sync game scores falhou:', e);
    }
  },
  calcAverage(scores) {
    if (!scores || !scores.length) return null;
    const sum = scores.reduce((acc, s) => acc + parseFloat(s.score), 0);
    return (sum / scores.length).toFixed(1);
  },

  // ── FALLBACK LOCAL (quando Sheets não está configurado) ──
  // Armazena em localStorage para desenvolvimento/demo

  local: {
    getKey: (k) => {
      try { return JSON.parse(localStorage.getItem('js_' + k) || 'null'); }
      catch { return null; }
    },
    setKey: (k, v) => localStorage.setItem('js_' + k, JSON.stringify(v)),

    getUsers() {
      return this.getKey('users') || [];
    },
    saveUsers(users) {
      this.setKey('users', users);
    },
    getMainScores() {
      return this.getKey('mainScores') || {};
    },
    saveMainScore(playerId, score) {
      const ms = this.getMainScores();
      if (!ms[playerId]) ms[playerId] = [];
      // Remove entrada antiga desse avaliador se houver
      const scores = { ...ms };
      scores[playerId] = score;
      this.setKey('mainScores', scores);
    },
    getGameScores() {
      return this.getKey('gameScores') || {};
    },
    submitGameScore(fixtureId, playerId, username, score) {
      const gs = this.getGameScores();
      if (!gs[fixtureId]) gs[fixtureId] = {};
      if (!gs[fixtureId][playerId]) gs[fixtureId][playerId] = {};
      gs[fixtureId][playerId][username] = score;
      this.setKey('gameScores', gs);
    },
    getPlayerGameAvg(fixtureId, playerId) {
      const gs = this.getGameScores();
      const playerScores = gs[fixtureId]?.[playerId];
      if (!playerScores) return null;
      const vals = Object.values(playerScores);
      if (!vals.length) return null;
      return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    },
    getUserGameScore(fixtureId, playerId, username) {
      const gs = this.getGameScores();
      return gs[fixtureId]?.[playerId]?.[username] ?? null;
    },
  }
};

// ── Decide se usa Sheets real ou localStorage ──
function isSheetsConfigured() {
  return !CONFIG.SHEETS_API_URL.includes('SEU_DEPLOYMENT_ID_AQUI');
}
