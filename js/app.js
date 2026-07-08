// =============================================
// JEANSCORE – APP PRINCIPAL
// =============================================

const PLAYER_PHOTOS = {
  'Cassio':'Cassio.jpg','Fagner':'Fagner.jpg','Fabricio Bruno':'Fabricio Bruno.jpg',
  'Kaiki Bruno':'Kaiki Bruno.jpg','Otavio':'Otavio.jpg','Walace':'Walace.jpg',
  'Lucas Silva':'Lucas Silva.jpg','Lucas Romero':'Lucas Romero.jpg','Christian':'Christian.jpg',
  'Wanderson':'Wanderson.jpg','Willian':'Willian.jpg','Mateus Pereira':'Mateus Pereira.jpg',
  'Gabigol':'Gabigol.jpg','Kaio Jorge':'Kaio Jorge.jpg','Kaua Prates':'Kaua Prates.jpg',
  'Lautaro Diaz':'Lautaro Diaz.jpg','Sinisterra':'Sinisterra.jpg','Bolasie':'Bolasie.jpg',
  'Gabriel Pec':'Gabriel Pec.jpg',
  'Eduardo':'Eduardo.png','Gamarra':'Gamarra.png','Japa':'Japa.png',
  'Joao Marcelo':'Joao Marcelo.png','Jonathan Jesus':'Jonathan Jesus.png',
  'Leo Aragao':'Leo Aragao.png','Marquinhos':'Marquinhos.png',
  'Mateus Henrique':'Mateus Henrique.png','Villalba':'Villalba.png','aposa':'aposa.png',
};

function getPlayerPhoto(name) {
  if (!name) return null;
  if (PLAYER_PHOTOS[name]) return PLAYER_PHOTOS[name];
  for (const [key, file] of Object.entries(PLAYER_PHOTOS)) {
    if (name.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(name.toLowerCase().split(' ')[0])) return file;
  }
  return null;
}

function playerImgHTML(name, apiPhoto, cssClass = '') {
  // Usa foto da API (API-Football) — fotos SofaScore bloqueadas por CORB no browser
  const src = apiPhoto || getPlayerPhoto(name) || '';
  if (src) return `<img src="${src}" alt="${name}" class="${cssClass}"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
    <span class="player-img-placeholder" style="display:none"><i class="fas fa-user"></i></span>`;
  return `<span class="player-img-placeholder"><i class="fas fa-user"></i></span>`;
}

function translatePos(pos) {
  return {Goalkeeper:'Goleiro',Defender:'Defensor',Midfielder:'Meia',Attacker:'Atacante'}[pos] || pos || '—';
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

function scoreColor(score) {
  if (score === null || score === undefined) return '';
  const n = parseFloat(score);
  if (n >= 7.5) return 'background:#22c55e;color:#fff';
  if (n >= 6)   return 'background:#f59e0b;color:#1a2f55';
  if (n >= 4)   return 'background:#3b82f6;color:#fff';
  return 'background:#ef4444;color:#fff';
}

// =============================================
// APP – NAVEGAÇÃO E ELENCO
// =============================================

const APP = {
  currentPage: 'elenco',
  allFixtures: [],
  squad: [],
  currentFixtureForRating: null,

  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');
    this.currentPage = page;
    if (page === 'elenco')   this.loadElenco();
    if (page === 'jogos')    this.loadJogos();
    if (page === 'rankings') this.loadRankings();
    if (page === 'avaliar')  this.loadAvaliar();
    if (page === 'admin')    this.loadAdmin();
  },

  async loadElenco() {
    const grid = document.getElementById('playersGrid');
    grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i> Carregando...</div>';
    const squad = await API.getSquad();
    this.squad = squad;
    if (!squad.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i>Não foi possível carregar o elenco.</div>';
      return;
    }
    const mainScores = isSheetsConfigured()
      ? (await SHEETS.getMainScores())?.scores || {}
      : SHEETS.local.getMainScores();
    this._renderPlayers(squad, mainScores, 'all');
    document.querySelectorAll('.filters .filter-btn[data-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filters .filter-btn[data-pos]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderPlayers(squad, mainScores, btn.dataset.pos);
      });
    });
  },

  _renderPlayers(squad, mainScores, posFilter) {
    const grid = document.getElementById('playersGrid');
    let players = posFilter === 'all' ? squad : squad.filter(p => p.position === posFilter);
    if (!players.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i>Nenhum jogador encontrado.</div>';
      return;
    }
    grid.innerHTML = players.map(p => {
      const scoreData = mainScores[p.id];
      const avg   = scoreData ? (typeof scoreData === 'object' ? scoreData.avg : scoreData) : null;
      const votes = scoreData?.votes || '';
      return `<div class="player-card" data-id="${p.id}">
        <div class="player-img-wrap">${playerImgHTML(p.name, p.photo)}</div>
        <div class="player-info">
          <div class="player-name">${p.name}</div>
          <div class="player-pos">${translatePos(p.position)}</div>
          <div class="player-number">#${p.number || '—'}</div>
          <div class="player-score">
            <span class="score-badge ${avg ? '' : 'no-score'}" style="${avg ? scoreColor(avg) : ''}">
              ${avg || '—'}
            </span>
            ${votes ? `<span class="score-votes">${votes} voto${votes > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  },
};

// =============================================
// APP – JOGOS
// =============================================

Object.assign(APP, {

  async loadJogos() {
    const list = document.getElementById('jogosList');
    list.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i> Carregando jogos...</div>';
    this.allFixtures = await API.getAllFixtures();
    this._renderJogos('proximos', 'all');

    document.querySelectorAll('.jogos-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jogos-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const comp = document.querySelector('.filters .filter-btn[data-comp].active')?.dataset.comp || 'all';
        this._renderJogos(btn.dataset.tab, comp);
      });
    });

    document.querySelectorAll('.filters .filter-btn[data-comp]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filters .filter-btn[data-comp]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = document.querySelector('.jogos-tabs .tab-btn.active')?.dataset.tab || 'proximos';
        this._renderJogos(tab, btn.dataset.comp);
      });
    });
  },

  _renderJogos(tab, compFilter) {
    const list = document.getElementById('jogosList');
    let fixtures = this.allFixtures.filter(f => API.isMonitoredComp(f));

    if (compFilter !== 'all') {
      fixtures = fixtures.filter(f => {
        const id = f._leagueId || API.getTournamentId(f.tournament?.name || '');
        return String(id) === String(compFilter);
      });
    }

    let filtered;
    if (tab === 'proximos') {
      filtered = fixtures.filter(f => { const s = API.formatStatus(f); return !s.done || s.live; })
        .sort((a, b) => a.startTimestamp - b.startTimestamp);
    } else {
      filtered = fixtures.filter(f => { const s = API.formatStatus(f); return s.done && !s.live; })
        .sort((a, b) => b.startTimestamp - a.startTimestamp);
    }

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i>Nenhum jogo encontrado.</div>';
      return;
    }

    list.innerHTML = filtered.map(f => {
      const status   = API.formatStatus(f);
      const score    = API.getScore(f);
      const scoreStr = (status.done || status.live) ? `${score.home} – ${score.away}` : 'vs';
      const gs       = SHEETS.local.getGameScores();
      const hasScores = gs[f.id] && Object.keys(gs[f.id]).length > 0;
      const homeLogo = f.homeTeam?.logo || (f.homeTeam?.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${f.homeTeam.id}.png` : '');
      const awayLogo = f.awayTeam?.logo || (f.awayTeam?.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${f.awayTeam.id}.png` : '');

      return `<div class="jogo-card" data-fixture="${f.id}">
        <span class="jogo-comp-badge">${API.compFlag(f)} ${API.compName(f)}</span>
        <div class="jogo-teams">
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${homeLogo}" alt="${f.homeTeam?.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.homeTeam?.name || '—'}</div>
          </div>
          <div class="jogo-placar ${status.live ? 'live' : ''}">${scoreStr}</div>
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${awayLogo}" alt="${f.awayTeam?.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.awayTeam?.name || '—'}</div>
          </div>
        </div>
        <div class="jogo-date">${API.formatDate(f.startTimestamp)}</div>
        <span class="jogo-status-badge ${status.css}">${status.live ? '🔴 AO VIVO' : status.label}</span>
        <div class="jogo-actions">
          ${status.done && AUTH.isLoggedIn()
            ? `<button class="btn btn-sm btn-primary" onclick="APP.openRatingModal(${f.id})">
                ${hasScores ? '✏️ Reeditar' : '⭐ Avaliar'}</button>` : ''}
        </div>
      </div>`;
    }).join('');
  },
});

// =============================================
// APP – AVALIAÇÃO
// =============================================

Object.assign(APP, {

  async openRatingModal(fixtureId) {
    if (!AUTH.isLoggedIn()) { showToast('Você precisa estar logado para avaliar.', 'error'); return; }
    const fixture = this.allFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;

    const modal   = document.getElementById('modalAvaliarJogo');
    const title   = document.getElementById('modalAvaliarTitle');
    const content = document.getElementById('modalAvaliarContent');
    const sc      = API.getScore(fixture);
    title.textContent = `${fixture.homeTeam?.name} ${sc.home} × ${sc.away} ${fixture.awayTeam?.name}`;
    content.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i></div>';
    modal.classList.add('open');

    const lineupData   = await API.getLineup(fixtureId);
    const participated = lineupData?.participated || [];
    const all          = lineupData?.all || [];

    const username = AUTH.getUsername();
    const savedScores = {};
    const gs = SHEETS.local.getGameScores();
    if (gs[fixtureId]) {
      Object.entries(gs[fixtureId]).forEach(([pid, userScores]) => {
        if (userScores[username] !== undefined) savedScores[pid] = userScores[username];
      });
    }

    this.currentFixtureForRating = { fixtureId, fixture, participated, all };

    const playersToShow = participated.length > 0 ? participated : this.squad.map(p => ({
      id: p.id, name: p.name, pos: p.position, played: true, starter: false
    }));

    if (!playersToShow.length) {
      content.innerHTML = '<p class="info-text">Escalação não disponível para este jogo.</p>';
      return;
    }

    content.innerHTML = playersToShow.map(p => {
      const saved   = savedScores[p.id] ?? null;
      const photo   = getPlayerPhoto(p.name) || p.photo || '';
      const imgTag  = photo
        ? `<img src="${photo}" alt="${p.name}" class="avaliar-player-img" onerror="this.style.opacity=0" />`
        : `<div class="avaliar-player-img" style="background:var(--blue-mid);border-radius:50%;display:flex;align-items:center;justify-content:center">
             <i class="fas fa-user" style="font-size:1.5rem;color:var(--gray-400)"></i></div>`;
      return `<div class="avaliar-player-card ${saved !== null ? 'rated' : ''}" id="apc-${p.id}">
        ${imgTag}
        <div class="avaliar-player-name">${p.name}</div>
        <div class="star-rating" data-player="${p.id}">
          ${[1,2,3,4,5,6,7,8,9,10].map(n =>
            `<button class="star-btn ${saved !== null && n <= saved ? 'active' : ''}"
               data-val="${n}" onclick="APP.setRating(${p.id}, ${n})">★</button>`
          ).join('')}
        </div>
        <input type="number" class="note-input" id="note-${p.id}"
          min="0" max="10" step="0.5" value="${saved !== null ? saved : ''}" placeholder="0–10"
          onchange="APP.setRatingInput(${p.id}, this.value)" />
      </div>`;
    }).join('');
  },

  setRating(playerId, value) {
    const input = document.getElementById(`note-${playerId}`);
    if (input) input.value = value;
    document.getElementById(`apc-${playerId}`)?.classList.add('rated');
    document.querySelectorAll(`.star-rating[data-player="${playerId}"] .star-btn`)
      .forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= value));
  },

  setRatingInput(playerId, value) {
    const n = parseFloat(value);
    if (!isNaN(n) && n >= 0 && n <= 10) this.setRating(playerId, Math.round(n));
  },

  async saveGameRatings() {
    if (!this.currentFixtureForRating) return;
    const { fixtureId, fixture, participated } = this.currentFixtureForRating;
    const username = AUTH.getUsername();
    const home     = fixture.homeTeam?.name || '';
    const away     = fixture.awayTeam?.name || '';
    const date     = API.formatDate(fixture.startTimestamp);

    const playersToScore = participated.length > 0 ? participated
      : this.squad.map(p => ({ id: p.id, name: p.name, played: true }));

    let saved = 0;
    for (const p of playersToScore) {
      const input = document.getElementById(`note-${p.id}`);
      if (!input || input.value === '') continue;
      const val = Math.min(10, Math.max(0, parseFloat(input.value)));
      if (isNaN(val)) continue;
      SHEETS.local.submitGameScore(fixtureId, p.id, username, val);
      saved++;
      if (isSheetsConfigured()) {
        await SHEETS.submitGameScore(fixtureId, date, home, away, p.id, p.name, username, val);
      }
    }

    document.getElementById('modalAvaliarJogo').classList.remove('open');
    showToast(`${saved} notas salvas!`, 'success');
    const activeTab  = document.querySelector('.jogos-tabs .tab-btn.active')?.dataset.tab || 'anteriores';
    const activeComp = document.querySelector('.filters .filter-btn[data-comp].active')?.dataset.comp || 'all';
    if (this.currentPage === 'jogos') this._renderJogos(activeTab, activeComp);
  },

  async loadAvaliar() {
    if (!AUTH.isLoggedIn()) {
      document.getElementById('avaliarContent').innerHTML =
        '<p class="info-text">Você precisa estar logado para avaliar jogadores.</p>';
      return;
    }
    const content = document.getElementById('avaliarJogosList');
    if (!this.allFixtures.length) {
      content.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i></div>';
      this.allFixtures = await API.getAllFixtures();
    }
    const past = this.allFixtures.filter(f => API.formatStatus(f).done && API.isMonitoredComp(f))
      .slice().reverse();

    if (!past.length) { content.innerHTML = '<p class="info-text">Nenhum jogo finalizado ainda.</p>'; return; }

    content.innerHTML = past.map(f => {
      const gs   = SHEETS.local.getGameScores();
      const user = AUTH.getUsername();
      const rated = gs[f.id] && Object.values(gs[f.id]).some(s => s[user] !== undefined);
      const sc   = API.getScore(f);
      return `<div class="jogo-card">
        <span class="jogo-comp-badge">${API.compFlag(f)} ${API.compName(f)}</span>
        <div class="jogo-times">
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${f.homeTeam?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${f.homeTeam?.id}.png`}"
              alt="${f.homeTeam?.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.homeTeam?.name || '—'}</div>
          </div>
          <div class="jogo-placar">${sc.home} – ${sc.away}</div>
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${f.awayTeam?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${f.awayTeam?.id}.png`}"
              alt="${f.awayTeam?.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.awayTeam?.name || '—'}</div>
          </div>
        </div>
        <div class="jogo-date">${API.formatDate(f.startTimestamp)}</div>
        <div class="jogo-actions">
          <button class="btn btn-sm btn-primary" onclick="APP.openRatingModal(${f.id})">
            ${rated ? '✏️ Editar notas' : '⭐ Dar notas'}</button>
        </div>
      </div>`;
    }).join('');
  },
});

// =============================================
// APP – RANKINGS
// =============================================

Object.assign(APP, {

  async loadRankings() {
    this._renderRankingGeral();
    this._renderRankingJogo();
  },

  _renderRankingGeral() {
    const el = document.getElementById('rankingGeral');
    const mainScores = SHEETS.local.getMainScores();
    const gs = SHEETS.local.getGameScores();
    const totals = {};

    Object.entries(mainScores).forEach(([pid, score]) => {
      if (!totals[pid]) totals[pid] = [];
      totals[pid].push(parseFloat(score));
    });
    Object.values(gs).forEach(fixture => {
      Object.entries(fixture).forEach(([pid, userScores]) => {
        if (!totals[pid]) totals[pid] = [];
        Object.values(userScores).forEach(s => totals[pid].push(parseFloat(s)));
      });
    });

    const ranked = Object.entries(totals)
      .map(([pid, scores]) => ({
        id: pid,
        avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
        votes: scores.length,
        name: this._getPlayerName(parseInt(pid)),
      }))
      .filter(p => p.name)
      .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg))
      .slice(0, 10);

    if (!ranked.length) { el.innerHTML = '<p class="info-text" style="padding:1rem">Nenhuma nota ainda.</p>'; return; }

    el.innerHTML = ranked.map((p, i) => {
      const cls   = ['gold','silver','bronze'][i] || '';
      const photo = getPlayerPhoto(p.name) || '';
      return `<div class="ranking-item">
        <span class="ranking-pos ${cls}">${i + 1}º</span>
        ${photo
          ? `<img class="ranking-avatar" src="${photo}" alt="${p.name}" onerror="this.style.display='none'" />`
          : `<div class="ranking-avatar" style="background:var(--blue-mid);display:flex;align-items:center;justify-content:center"><i class="fas fa-user" style="color:var(--gray-400)"></i></div>`}
        <span class="ranking-name">${p.name}</span>
        <span class="ranking-score" style="${scoreColor(p.avg)};padding:0.15rem 0.5rem;border-radius:4px">${p.avg}</span>
      </div>`;
    }).join('');
  },

  _renderRankingJogo() {
    const el = document.getElementById('rankingJogo');
    const gs = SHEETS.local.getGameScores();
    const best = [];

    Object.entries(gs).forEach(([fid, players]) => {
      const fx = this.allFixtures.find(f => String(f.id) === String(fid));
      const label = fx ? `${fx.homeTeam?.name} × ${fx.awayTeam?.name}` : `Jogo #${fid}`;
      Object.entries(players).forEach(([pid, userScores]) => {
        const vals = Object.values(userScores).map(Number);
        const avg  = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
        const name = this._getPlayerName(parseInt(pid));
        if (name) best.push({ name, avg, match: label });
      });
    });

    best.sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));
    const top = best.slice(0, 10);

    if (!top.length) { el.innerHTML = '<p class="info-text" style="padding:1rem">Nenhuma nota de jogo ainda.</p>'; return; }

    el.innerHTML = top.map((p, i) => {
      const cls   = ['gold','silver','bronze'][i] || '';
      const photo = getPlayerPhoto(p.name) || '';
      return `<div class="ranking-item">
        <span class="ranking-pos ${cls}">${i + 1}º</span>
        ${photo
          ? `<img class="ranking-avatar" src="${photo}" alt="${p.name}" onerror="this.style.display='none'" />`
          : `<div class="ranking-avatar" style="background:var(--blue-mid);display:flex;align-items:center;justify-content:center"><i class="fas fa-user" style="color:var(--gray-400)"></i></div>`}
        <div style="flex:1">
          <div class="ranking-name">${p.name}</div>
          <div style="font-size:0.72rem;color:var(--gray-400)">${p.match}</div>
        </div>
        <span class="ranking-score" style="${scoreColor(p.avg)};padding:0.15rem 0.5rem;border-radius:4px">${p.avg}</span>
      </div>`;
    }).join('');
  },

  _getPlayerName(id) {
    const p = this.squad.find(s => s.id === id);
    return p ? p.name : null;
  },
});

// =============================================
// APP – ADMIN
// =============================================

Object.assign(APP, {

  loadAdmin() {
    if (!AUTH.isAdmin()) return;
    this._showAdminTab('pendentes');
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._showAdminTab(btn.dataset.adminTab);
      });
    });
  },

  _showAdminTab(tab) {
    document.querySelectorAll('.admin-content > div').forEach(d => d.classList.remove('active-tab'));
    document.getElementById(`admin-${tab}`)?.classList.add('active-tab');
    if (tab === 'pendentes') this._loadPendentes();
    if (tab === 'usuarios')  this._loadUsuarios();
    if (tab === 'notas')     this._loadNotasAdmin();
    if (tab === 'jogos')     this.loadAdminJogos();
  },

  _loadPendentes() {
    const users   = SHEETS.local.getUsers();
    const pending = users.filter(u => u.status === 'pending');
    const el      = document.getElementById('pendentesList');
    if (!pending.length) { el.innerHTML = '<p class="info-text">Nenhum cadastro pendente.</p>'; return; }
    el.innerHTML = pending.map(u => `
      <div class="pending-item" id="pend-${u.username}">
        <div class="pending-info">
          <div class="pending-name">${u.username} <span class="badge-pending">Pendente</span></div>
          <div class="pending-email">${u.email}</div>
          <div style="font-size:0.75rem;color:var(--gray-400)">Solicitado em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="pending-actions">
          <button class="btn btn-sm btn-success" onclick="APP.approveUser('${u.username}')"><i class="fas fa-check"></i> Aprovar</button>
          <button class="btn btn-sm btn-danger"  onclick="APP.rejectUser('${u.username}')"><i class="fas fa-times"></i> Recusar</button>
        </div>
      </div>`).join('');
  },

  approveUser(username) {
    const users = SHEETS.local.getUsers();
    const u = users.find(u => u.username === username);
    if (u) { u.status = 'approved'; SHEETS.local.saveUsers(users); }
    if (isSheetsConfigured()) SHEETS.approveUser(username);
    document.getElementById(`pend-${username}`)?.remove();
    showToast(`${username} aprovado!`, 'success');
    this._loadPendentes();
  },

  rejectUser(username) {
    const users = SHEETS.local.getUsers();
    const u = users.find(u => u.username === username);
    if (u) { u.status = 'rejected'; SHEETS.local.saveUsers(users); }
    if (isSheetsConfigured()) SHEETS.rejectUser(username);
    document.getElementById(`pend-${username}`)?.remove();
    showToast(`${username} recusado.`);
    this._loadPendentes();
  },

  _loadUsuarios() {
    const users = SHEETS.local.getUsers().filter(u => u.status === 'approved');
    const el    = document.getElementById('usuariosList');
    if (!users.length) { el.innerHTML = '<p class="info-text">Nenhum usuário ativo.</p>'; return; }
    el.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="user-info">
          <div class="user-name">${u.username}${u.role === 'admin' ? '<span class="badge-admin">ADMIN</span>' : ''}</div>
          <div class="user-email">${u.email}</div>
        </div>
      </div>`).join('');
  },

  _loadNotasAdmin() {
    const el = document.getElementById('notasAdminList');
    if (!this.squad.length) { el.innerHTML = '<p class="info-text">Carregue o elenco primeiro.</p>'; return; }
    const mainScores = SHEETS.local.getMainScores();
    el.innerHTML = this.squad.map(p => {
      const score = mainScores[p.id] ?? '';
      return `<div class="player-card">
        <div class="player-img-wrap">${playerImgHTML(p.name, p.photo)}</div>
        <div class="player-info">
          <div class="player-name">${p.name}</div>
          <div class="player-pos">${translatePos(p.position)}</div>
          <div class="player-score" style="margin-top:0.5rem;gap:0.5rem">
            <input type="number" class="note-input" id="adm-note-${p.id}"
              min="0" max="10" step="0.5" value="${score}" placeholder="—" style="width:65px" />
            <button class="btn btn-sm btn-primary" onclick="APP.saveMainScore(${p.id}, '${p.name}')">OK</button>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  saveMainScore(playerId, playerName) {
    const input = document.getElementById(`adm-note-${playerId}`);
    if (!input) return;
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 0 || val > 10) { showToast('Nota inválida (0–10)', 'error'); return; }
    SHEETS.local.saveMainScore(playerId, val);
    if (isSheetsConfigured()) SHEETS.setMainScore(playerId, playerName, val, AUTH.getUsername());
    showToast(`Nota de ${playerName} salva: ${val}`, 'success');
  },
});

// =============================================
// INICIALIZAÇÃO
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  AUTH.init();

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); APP.navigate(link.dataset.page); });
  });

  document.getElementById('btnLogin').addEventListener('click', () =>
    document.getElementById('modalLogin').classList.add('open'));
  document.getElementById('closeLogin').addEventListener('click', () =>
    document.getElementById('modalLogin').classList.remove('open'));

  document.getElementById('formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const res  = await AUTH.login(user, pass);
    if (!res.ok) { errEl.textContent = res.error; return; }
    document.getElementById('modalLogin').classList.remove('open');
    showToast(`Bem-vindo, ${user}!`, 'success');
    APP.navigate('elenco');
  });

  document.getElementById('btnRegister').addEventListener('click', () =>
    document.getElementById('modalRegister').classList.add('open'));
  document.getElementById('closeRegister').addEventListener('click', () =>
    document.getElementById('modalRegister').classList.remove('open'));

  document.getElementById('formRegister').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl  = document.getElementById('regError');
    const succEl = document.getElementById('regSuccess');
    errEl.textContent = succEl.textContent = '';
    const user  = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass  = document.getElementById('regPass').value;
    const res   = await AUTH.register(user, email, pass);
    if (!res.ok) { errEl.textContent = res.error; return; }
    succEl.textContent = res.message || 'Cadastro solicitado! Aguarde aprovação.';
    document.getElementById('formRegister').reset();
  });

  document.getElementById('btnLogout').addEventListener('click', () => AUTH.logout());

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });

  document.getElementById('btnSalvarNotas').addEventListener('click', () => APP.saveGameRatings());
  document.getElementById('closeAvaliarJogo').addEventListener('click', () =>
    document.getElementById('modalAvaliarJogo').classList.remove('open'));
  document.getElementById('closeNotaPrincipal').addEventListener('click', () =>
    document.getElementById('modalNotaPrincipal').classList.remove('open'));

  APP.navigate('elenco');

  // Atualiza ao vivo a cada 60s
  setInterval(() => {
    if (APP.currentPage === 'jogos' && APP.allFixtures.some(f => API.formatStatus(f).live)) {
      APP.loadJogos();
    }
  }, 60000);
});

// =============================================
// ADMIN – CADASTRO DE JOGOS
// =============================================

Object.assign(APP, {

  _currentAdminJogoId: null,

  _showAdminTabOrig: APP._showAdminTab,

  loadAdminJogos() {
    this._setupJogoForm();
    this._loadAdminJogosList();
  },

  _setupJogoForm() {
    document.getElementById('btnSalvarJogo').onclick = () => this._salvarJogo();
    document.getElementById('btnLimparJogo').onclick = () => this._limparJogoForm();
    document.getElementById('btnSalvarEscalacao').onclick = () => this._salvarEscalacao();
  },

  _limparJogoForm() {
    document.getElementById('jogoEditId').value = '';
    document.getElementById('jogoHomeTeam').value = '';
    document.getElementById('jogoAwayTeam').value = '';
    document.getElementById('jogoDate').value = '';
    document.getElementById('jogoHomeScore').value = '';
    document.getElementById('jogoAwayScore').value = '';
    document.getElementById('jogoStatus').value = 'notstarted';
    document.getElementById('jogoComp').value = '71';
    document.getElementById('adminEscalacaoWrap').style.display = 'none';
    this._currentAdminJogoId = null;
  },

  _salvarJogo() {
    const editId   = document.getElementById('jogoEditId').value;
    const home     = document.getElementById('jogoHomeTeam').value.trim();
    const away     = document.getElementById('jogoAwayTeam').value.trim();
    const date     = document.getElementById('jogoDate').value;
    const comp     = document.getElementById('jogoComp').value;
    const hScore   = document.getElementById('jogoHomeScore').value;
    const aScore   = document.getElementById('jogoAwayScore').value;
    const status   = document.getElementById('jogoStatus').value;

    if (!home || !away || !date) { showToast('Preencha times e data', 'error'); return; }

    const id = editId || `manual_${Date.now()}`;
    const ts = Math.floor(new Date(date).getTime() / 1000);
    const leagueInfo = CONFIG.COMPETITIONS[comp] || {};

    const jogo = {
      id, home, away,
      timestamp: ts,
      leagueId: parseInt(comp),
      leagueName: leagueInfo.name || '',
      homeScore: hScore !== '' ? parseInt(hScore) : null,
      awayScore: aScore !== '' ? parseInt(aScore) : null,
      status,
      manual: true,
    };

    // Salva no localStorage
    const jogos = this._getManualJogos();
    const idx = jogos.findIndex(j => j.id === id);
    if (idx >= 0) jogos[idx] = jogo; else jogos.push(jogo);
    localStorage.setItem('js_manualJogos', JSON.stringify(jogos));

    // Salva no Sheets se configurado
    if (isSheetsConfigured()) {
      SHEETS.request('saveManualJogo', jogo);
    }

    showToast('Jogo salvo!', 'success');
    document.getElementById('jogoEditId').value = id;
    this._currentAdminJogoId = id;

    // Mostra painel de escalação
    this._mostrarEscalacao(id, home, away);
    this._loadAdminJogosList();
  },

  _getManualJogos() {
    try { return JSON.parse(localStorage.getItem('js_manualJogos') || '[]'); }
    catch { return []; }
  },

  _mostrarEscalacao(jogoId, home, away) {
    document.getElementById('adminEscalacaoWrap').style.display = 'block';
    document.getElementById('adminEscalacaoTitle').textContent = `${home} × ${away}`;
    this._currentAdminJogoId = jogoId;

    // Carrega escalação salva
    const escalacoes = this._getEscalacoes();
    const saved = new Set(escalacoes[jogoId] || []);

    const grid = document.getElementById('adminEscalacaoGrid');
    if (!this.squad.length) {
      grid.innerHTML = '<p class="info-text">Carregue o elenco primeiro (clique em Elenco no menu).</p>';
      return;
    }

    grid.innerHTML = this.squad.map(p => {
      const photo = p.photo || getPlayerPhoto(p.name) || '';
      const sel   = saved.has(String(p.id));
      return `<div class="escalacao-card ${sel ? 'selected' : ''}"
        id="esc-${p.id}" onclick="APP._toggleEscalacao('${p.id}')">
        ${photo
          ? `<img src="${photo}" alt="${p.name}" onerror="this.style.display='none'" />`
          : `<div style="width:48px;height:48px;border-radius:50%;background:var(--blue-mid);margin:0 auto 0.4rem;display:flex;align-items:center;justify-content:center"><i class="fas fa-user" style="color:var(--gray-400)"></i></div>`}
        <div class="escalacao-card-name">${p.name}</div>
        <div class="escalacao-card-pos">${translatePos(p.position)}</div>
      </div>`;
    }).join('');
  },

  _toggleEscalacao(playerId) {
    const card = document.getElementById(`esc-${playerId}`);
    card?.classList.toggle('selected');
  },

  _getEscalacoes() {
    try { return JSON.parse(localStorage.getItem('js_escalacoes') || '{}'); }
    catch { return {}; }
  },

  _salvarEscalacao() {
    if (!this._currentAdminJogoId) return;
    const selected = [...document.querySelectorAll('.escalacao-card.selected')]
      .map(c => c.id.replace('esc-', ''));

    const escalacoes = this._getEscalacoes();
    escalacoes[this._currentAdminJogoId] = selected;
    localStorage.setItem('js_escalacoes', JSON.stringify(escalacoes));

    if (isSheetsConfigured()) {
      SHEETS.request('saveEscalacao', { jogoId: this._currentAdminJogoId, playerIds: selected });
    }

    showToast(`Escalação salva: ${selected.length} jogadores`, 'success');
  },

  _loadAdminJogosList() {
    const el    = document.getElementById('adminJogosList');
    const jogos = this._getManualJogos();
    if (!jogos.length) {
      el.innerHTML = '<p class="info-text">Nenhum jogo cadastrado ainda.</p>';
      return;
    }

    el.innerHTML = jogos.slice().reverse().map(j => {
      const comp = CONFIG.COMPETITIONS[j.leagueId] || {};
      const date = new Date(j.timestamp * 1000).toLocaleDateString('pt-BR', {
        day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
      });
      const placar = j.homeScore !== null && j.awayScore !== null
        ? `${j.homeScore} – ${j.awayScore}` : 'vs';
      return `<div class="jogo-card">
        <span class="jogo-comp-badge">${comp.flag || '⚽'} ${comp.short || j.leagueName}</span>
        <div class="jogo-teams">
          <div class="jogo-team"><div class="jogo-team-name">${j.home}</div></div>
          <div class="jogo-placar">${placar}</div>
          <div class="jogo-team"><div class="jogo-team-name">${j.away}</div></div>
        </div>
        <div class="jogo-date">${date}</div>
        <div class="jogo-actions">
          <button class="btn btn-sm btn-outline" onclick="APP._editarJogo('${j.id}')">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="APP._deletarJogo('${j.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
    }).join('');
  },

  _editarJogo(id) {
    const jogos = this._getManualJogos();
    const j = jogos.find(x => x.id === id);
    if (!j) return;

    document.getElementById('jogoEditId').value = j.id;
    document.getElementById('jogoHomeTeam').value = j.home;
    document.getElementById('jogoAwayTeam').value = j.away;
    document.getElementById('jogoComp').value = j.leagueId;
    document.getElementById('jogoStatus').value = j.status;
    document.getElementById('jogoHomeScore').value = j.homeScore ?? '';
    document.getElementById('jogoAwayScore').value = j.awayScore ?? '';

    // Converte timestamp para datetime-local
    const d = new Date(j.timestamp * 1000);
    const local = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('jogoDate').value = local;

    this._mostrarEscalacao(id, j.home, j.away);
    document.getElementById('admin-jogos').scrollIntoView({ behavior: 'smooth' });
  },

  _deletarJogo(id) {
    if (!confirm('Deletar este jogo?')) return;
    const jogos = this._getManualJogos().filter(j => j.id !== id);
    localStorage.setItem('js_manualJogos', JSON.stringify(jogos));
    showToast('Jogo removido.');
    this._loadAdminJogosList();
  },
});
