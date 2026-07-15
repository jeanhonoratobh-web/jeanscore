// =============================================
// JEANSCORE – SUPABASE CLIENT
// Replaces Google Sheets / Apps Script backend
// =============================================

const SUPA = {
  URL:  'https://ozsissvmrniwmgxsgzdh.supabase.co',
  KEY:  'sb_publishable_gke_OLA7RhoTCuunJrJzoA_a9vX4GUp',

  // ── Base request ──
  async _req(method, path, body = null, params = '') {
    const url = `${this.URL}/rest/v1/${path}${params ? '?' + params : ''}`;
    const opts = {
      method,
      headers: {
        'apikey':        this.KEY,
        'Authorization': `Bearer ${this.KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Supabase error:', res.status, err);
        return { ok: false, error: err.message || `HTTP ${res.status}` };
      }
      const data = await res.json().catch(() => null);
      return { ok: true, data };
    } catch(e) {
      console.error('Supabase fetch error:', e);
      return { ok: false, error: e.message };
    }
  },

  get:    (path, params) => SUPA._req('GET',    path, null, params),
  post:   (path, body)   => SUPA._req('POST',   path, body),
  patch:  (path, body, params) => SUPA._req('PATCH', path, body, params),
  delete: (path, params) => SUPA._req('DELETE', path, null, params),

  // ── RPC (stored procedures) ──
  async rpc(fn, args = {}) {
    const url = `${this.URL}/rest/v1/rpc/${fn}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey':        this.KEY,
        'Authorization': `Bearer ${this.KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { ok: true, data } : { ok: false, error: data?.message };
  },

  // =============================================
  // USERS
  // =============================================

  async getUsers() {
    const r = await this.get('users', 'select=username,email,role,status,created_at&order=created_at.asc');
    return r.ok ? { ok: true, users: r.data } : r;
  },

  async registerUser(username, email, passHash) {
    // Check duplicates
    const check = await this.get('users', `select=username,email&or=(username.eq.${encodeURIComponent(username)},email.eq.${encodeURIComponent(email)})`);
    if (check.ok && check.data?.length) {
      const existing = check.data[0];
      if (existing.username === username) return { ok: false, error: 'Nome de usuário já existe' };
      return { ok: false, error: 'E-mail já cadastrado' };
    }
    const r = await this.post('users', { username, email, pass_hash: passHash, role: 'user', status: 'pending' });
    return r.ok ? { ok: true, message: 'Cadastro solicitado! Aguarde aprovação do admin.' } : r;
  },

  async loginUser(username, passHash) {
    const r = await this.get('users', `select=username,email,role,status&username=eq.${encodeURIComponent(username)}&pass_hash=eq.${encodeURIComponent(passHash)}&limit=1`);
    if (!r.ok || !r.data?.length) return { ok: false, error: 'Usuário ou senha incorretos' };
    const user = r.data[0];
    if (user.status === 'pending')  return { ok: false, error: 'Cadastro ainda não aprovado' };
    if (user.status === 'rejected') return { ok: false, error: 'Cadastro recusado' };
    return { ok: true, user: { username: user.username, email: user.email, role: user.role } };
  },

  async updateUserStatus(username, status) {
    const r = await this.patch(`users?username=eq.${encodeURIComponent(username)}`, { status });
    return r.ok ? { ok: true } : r;
  },

  // =============================================
  // SQUAD
  // =============================================

  async getSquad() {
    const r = await this.get('squad', 'select=*&order=position.asc,number.asc');
    return r.ok ? { ok: true, players: r.data } : r;
  },

  async upsertSquad(players) {
    const r = await this._req('POST', 'squad', players, '');
    // Use upsert header
    const url = `${this.URL}/rest/v1/squad`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey':        this.KEY,
        'Authorization': `Bearer ${this.KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify(players),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  },

  async addPlayer(player) {
    const r = await this.post('squad', player);
    return r.ok ? { ok: true } : r;
  },

  async updatePlayer(id, fields) {
    const r = await this.patch(`squad?id=eq.${encodeURIComponent(id)}`, fields);
    return r.ok ? { ok: true } : r;
  },

  async deletePlayer(id) {
    const r = await this.delete(`squad?id=eq.${encodeURIComponent(id)}`);
    return r.ok ? { ok: true } : r;
  },

  // =============================================
  // FIXTURES
  // =============================================

  async getFixtures() {
    const r = await this.get('fixtures', 'select=*&order=ts.asc');
    return r.ok ? { ok: true, jogos: r.data?.map(f => ({
      id:        f.id,
      home:      f.home_team,
      away:      f.away_team,
      homeScore: f.home_score,
      awayScore: f.away_score,
      date:      f.fixture_date,
      timestamp: f.ts,
      comp:      f.competition,
      stadium:   f.stadium,
      status:    f.status,
      liberado:  f.liberado,
      manual:    f.manual,
    })) } : r;
  },

  async upsertFixtures(fixtures) {
    const rows = fixtures.map(f => ({
      id:           f.id,
      home_team:    f.home,
      away_team:    f.away,
      home_score:   f.homeScore ?? null,
      away_score:   f.awayScore ?? null,
      fixture_date: f.date || '',
      ts:           f.timestamp || 0,
      competition:  f.comp || '',
      stadium:      f.stadium || '',
      status:       f.status || 'notstarted',
      liberado:     f.liberado || false,
      manual:       f.manual || false,
    }));
    const url = `${this.URL}/rest/v1/fixtures`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey':        this.KEY,
        'Authorization': `Bearer ${this.KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  },

  async updateFixtureLiberado(id, liberado) {
    const r = await this.patch(`fixtures?id=eq.${encodeURIComponent(id)}`, { liberado });
    return r.ok ? { ok: true } : r;
  },

  // =============================================
  // ESCALAÇÕES
  // =============================================

  async getEscalacao(fixtureId) {
    const r = await this.get('escalacoes', `fixture_id=eq.${encodeURIComponent(fixtureId)}&select=player_id`);
    return r.ok ? { ok: true, playerIds: r.data?.map(e => e.player_id) || [] } : r;
  },

  async saveEscalacao(fixtureId, playerIds) {
    // Delete existing first
    await this.delete(`escalacoes?fixture_id=eq.${encodeURIComponent(fixtureId)}`);
    if (!playerIds.length) return { ok: true };
    const rows = playerIds.map(pid => ({ fixture_id: fixtureId, player_id: String(pid) }));
    const r = await this.post('escalacoes', rows);
    return r.ok ? { ok: true } : r;
  },

  // =============================================
  // GAME SCORES
  // =============================================

  async getAllGameScores() {
    const r = await this.get('game_scores', 'select=fixture_id,player_id,player_name,username,score&order=created_at.asc');
    return r.ok ? { ok: true, scores: r.data } : r;
  },

  async getGameScores(fixtureId) {
    const r = await this.get('game_scores', `fixture_id=eq.${encodeURIComponent(fixtureId)}&select=player_id,player_name,username,score`);
    if (!r.ok) return r;
    // Aggregate by player
    const byPlayer = {};
    r.data?.forEach(s => {
      if (!byPlayer[s.player_id]) byPlayer[s.player_id] = { name: s.player_name, scores: [] };
      byPlayer[s.player_id].scores.push(parseFloat(s.score));
    });
    const aggregated = Object.entries(byPlayer).map(([pid, d]) => ({
      playerId:   pid,
      playerName: d.name,
      avg:        (d.scores.reduce((a,b)=>a+b,0)/d.scores.length).toFixed(1),
      votes:      d.scores.length,
    }));
    return { ok: true, scores: aggregated };
  },

  async submitGameScore(fixtureId, playerId, playerName, username, score, homeTeam, awayTeam, fixtureDate) {
    // Upsert (update if exists, insert if not)
    const url = `${this.URL}/rest/v1/game_scores`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey':        this.KEY,
        'Authorization': `Bearer ${this.KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        fixture_id:   String(fixtureId),
        player_id:    String(playerId),
        player_name:  playerName,
        username,
        score:        parseFloat(score),
        home_team:    homeTeam || '',
        away_team:    awayTeam || '',
        fixture_date: fixtureDate || '',
      }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  },

  // =============================================
  // PERMANENT SCORES
  // =============================================

  async getPermanentScores(year) {
    const r = await this.get('permanent_scores', `year=eq.${year}&select=player_id,player_name,username,score`);
    if (!r.ok) return r;
    const byPlayer = {};
    r.data?.forEach(s => {
      if (!byPlayer[s.player_id]) byPlayer[s.player_id] = { name: s.player_name, notes: [], users: {} };
      byPlayer[s.player_id].notes.push(parseFloat(s.score));
      byPlayer[s.player_id].users[s.username] = parseFloat(s.score);
    });
    const scores = {};
    Object.entries(byPlayer).forEach(([pid, d]) => {
      scores[pid] = {
        avg:    parseFloat((d.notes.reduce((a,b)=>a+b,0)/d.notes.length).toFixed(1)),
        votes:  d.notes.length,
        byUser: d.users,
      };
    });
    return { ok: true, scores };
  },

  async savePermanentScore(playerId, playerName, username, year, score) {
    const url = `${this.URL}/rest/v1/permanent_scores`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey':        this.KEY,
        'Authorization': `Bearer ${this.KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify({ player_id: String(playerId), player_name: playerName, username, year, score: parseFloat(score) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      // Duplicate = already rated
      if (err.code === '23505') return { ok: false, error: 'Você já deu nota permanente para este jogador este ano.' };
      return { ok: false, error: err.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  },
};
