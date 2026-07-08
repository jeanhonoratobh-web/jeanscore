// =============================================
// JEANSCORE – APP PRINCIPAL
// =============================================

// Mapa de fotos locais (nome do arquivo sem extensão → path)
const PLAYER_PHOTOS = {
  'Cassio':           'Cassio.jpg',
  'Fagner':           'Fagner.jpg',
  'Fabricio Bruno':   'Fabricio Bruno.jpg',
  'Kaiki Bruno':      'Kaiki Bruno.jpg',
  'Otavio':           'Otavio.jpg',
  'Walace':           'Walace.jpg',
  'Lucas Silva':      'Lucas Silva.jpg',
  'Lucas Romero':     'Lucas Romero.jpg',
  'Christian':        'Christian.jpg',
  'Wanderson':        'Wanderson.jpg',
  'Willian':          'Willian.jpg',
  'Mateus Pereira':   'Mateus Pereira.jpg',
  'Gabigol':          'Gabigol.jpg',
  'Kaio Jorge':       'Kaio Jorge.jpg',
  'Kaua Prates':      'Kaua Prates.jpg',
  'Lautaro Diaz':     'Lautaro Diaz.jpg',
  'Sinisterra':       'Sinisterra.jpg',
  'Bolasie':          'Bolasie.jpg',
  'Eduardo':          'Eduardo.png',
  'Gamarra':          'Gamarra.png',
  'Japa':             'Japa.png',
  'Joao Marcelo':     'Joao Marcelo.png',
  'Jonathan Jesus':   'Jonathan Jesus.png',
  'Leo Aragao':       'Leo Aragao.png',
  'Marquinhos':       'Marquinhos.png',
  'Mateus Henrique':  'Mateus Henrique.png',
  'Villalba':         'Villalba.png',
  'aposa':            'aposa.png',
};

function getPlayerPhoto(name) {
  if (!name) return null;
  // Busca exata
  if (PLAYER_PHOTOS[name]) return PLAYER_PHOTOS[name];
  // Busca parcial (sobrenome)
  for (const [key, file] of Object.entries(PLAYER_PHOTOS)) {
    if (name.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
      return file;
    }
  }
  return null;
}

function playerImgHTML(name, apiPhoto, cssClass = '') {
  const local = getPlayerPhoto(name);
  const src   = local || apiPhoto || '';
  if (src) {
    return `<img src="${src}" alt="${name}" class="${cssClass}"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
            <span class="player-img-placeholder" style="display:none"><i class="fas fa-user"></i></span>`;
  }
  return `<span class="player-img-placeholder"><i class="fas fa-user"></i></span>`;
}

// ── Posição traduzida ──
function translatePos(pos) {
  const map = { Goalkeeper: 'Goleiro', Defender: 'Defensor', Midfielder: 'Meia', Attacker: 'Atacante' };
  return map[pos] || pos || '—';
}

// ── Toast ──
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Nota com cor ──
function scoreColor(score) {
  if (score === null || score === undefined) return '';
  const n = parseFloat(score);
  if (n >= 7.5) return 'background:#22c55e;color:#fff';
  if (n >= 6)   return 'background:#f59e0b;color:#1a2f55';
  if (n >= 4)   return 'background:#3b82f6;color:#fff';
  return 'background:#ef4444;color:#fff';
}

// =============================================
// NAVEGAÇÃO
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

  // ── ELENCO ──
  async loadElenco() {
    const grid = document.getElementById('playersGrid');
    grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i> Carregando...</div>';

    const squad = await API.getSquad();
    this.squad  = squad;

    if (!squad.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i>Não foi possível carregar o elenco.</div>';
      return;
    }

    const mainScores = isSheetsConfigured()
      ? (await SHEETS.getMainScores())?.scores || {}
      : SHEETS.local.getMainScores();

    this._renderPlayers(squad, mainScores, 'all');

    // Filtros de posição
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
    let players = squad;
    if (posFilter !== 'all') players = squad.filter(p => p.position === posFilter);

    if (!players.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i>Nenhum jogador encontrado.</div>';
      return;
    }

    grid.innerHTML = players.map(p => {
      const scoreData = mainScores[p.id];
      const avg  = scoreData ? (typeof scoreData === 'object' ? scoreData.avg : scoreData) : null;
      const votes = scoreData?.votes || '';

      return `
      <div class="player-card" data-id="${p.id}">
        <div class="player-img-wrap">
          ${playerImgHTML(p.name, p.photo)}
        </div>
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
// JOGOS
// =============================================

Object.assign(APP, {

  async loadJogos() {
    const list = document.getElementById('jogosList');
    list.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i> Carregando jogos...</div>';

    const all = await API.getAllFixtures();
    this.allFixtures = all;

    this._renderJogos('proximos', 'all');

    // Tabs
    document.querySelectorAll('.jogos-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jogos-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const activeComp = document.querySelector('.filters .filter-btn[data-comp].active')?.dataset.comp || 'all';
        this._renderJogos(btn.dataset.tab, activeComp);
      });
    });

    // Filtros de competição
    document.querySelectorAll('.filters .filter-btn[data-comp]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filters .filter-btn[data-comp]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const activeTab = document.querySelector('.jogos-tabs .tab-btn.active')?.dataset.tab || 'proximos';
        this._renderJogos(activeTab, btn.dataset.comp);
      });
    });
  },

  _renderJogos(tab, compFilter) {
    const list = document.getElementById('jogosList');

    let fixtures = this.allFixtures;

    // Filtra por competição monitorada
    fixtures = fixtures.filter(f => API.isMonitoredComp(f));

    // Filtra por competição específica
    if (compFilter !== 'all') {
      fixtures = fixtures.filter(f => {
        const id = API.getTournamentId(f.tournament?.name || '');
        return String(id) === String(compFilter);
      });
    }

    // Separa passados/futuros
    let filtered;
    if (tab === 'proximos') {
      filtered = fixtures.filter(f => {
        const st = API.formatStatus(f);
        return !st.done || st.live;
      }).sort((a, b) => a.startTimestamp - b.startTimestamp);
    } else {
      filtered = fixtures.filter(f => {
        const st = API.formatStatus(f);
        return st.done && !st.live;
      }).sort((a, b) => b.startTimestamp - a.startTimestamp);
    }

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i>Nenhum jogo encontrado.</div>';
      return;
    }

    list.innerHTML = filtered.map(f => {
      const status = API.formatStatus(f);
      const score  = API.getScore(f);
      const scoreStr = status.done || status.live
        ? `${score.home} – ${score.away}` : `vs`;

      const gs = SHEETS.local.getGameScores();
      const hasScores = gs[f.id] && Object.keys(gs[f.id]).length > 0;

      const homeLogo = f.homeTeam?.id
        ? `https://api.sofascore.com/api/v1/team/${f.homeTeam.id}/image`
        : '';
      const awayLogo = f.awayTeam?.id
        ? `https://api.sofascore.com/api/v1/team/${f.awayTeam.id}/image`
        : '';

      return `
      <div class="jogo-card" data-fixture="${f.id}">
        <span class="jogo-comp-badge">${API.compFlag(f)} ${API.compName(f)}</span>
        <div class="jogo-teams">
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${homeLogo}" alt="${f.homeTeam?.name}"
              onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.homeTeam?.name || '—'}</div>
          </div>
          <div class="jogo-placar ${status.live ? 'live' : ''}">${scoreStr}</div>
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${awayLogo}" alt="${f.awayTeam?.name}"
              onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.awayTeam?.name || '—'}</div>
          </div>
        </div>
        <div class="jogo-date">${API.formatDate(f.startTimestamp)}</div>
        <span class="jogo-status-badge ${status.css}">${status.live ? '🔴 AO VIVO' : status.label}</span>
        <div class="jogo-actions">
          ${status.done && AUTH.isLoggedIn()
            ? `<button class="btn btn-sm btn-primary" onclick="APP.openRatingModal(${f.id})">
                ${hasScores ? '✏️ Reeditar' : '⭐ Avaliar'}
               </button>`
            : ''}
        </div>
      </div>`;
    }).join('');
  },
});    this._renderJogos('proximos', 'all');

    // Tabs
    document.querySelectorAll('.jogos-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jogos-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const activeComp = document.querySelector('.filters .filter-btn[data-comp].active')?.dataset.comp || 'all';
        this._renderJogos(btn.dataset.tab, activeComp);
      });
    });

    // Filtros de competição
    document.querySelectorAll('.filters .filter-btn[data-comp]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filters .filter-btn[data-comp]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const activeTab = document.querySelector('.jogos-tabs .tab-btn.active')?.dataset.tab || 'proximos';
        this._renderJogos(activeTab, btn.dataset.comp);
      });
    });
  },

  _renderJogos(tab, compFilter) {
    const list = document.getElementById('jogosList');
    const now  = new Date();

    let fixtures = this.allFixtures;
    if (compFilter !== 'all') fixtures = fixtures.filter(f => String(f.league.id) === String(compFilter));

    let filtered;
    if (tab === 'proximos') {
      filtered = fixtures.filter(f => {
        const st = API.formatStatus(f);
        return !st.done || f._live;
      }).sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    } else {
      filtered = fixtures.filter(f => {
        const st = API.formatStatus(f);
        return st.done && !f._live;
      }).sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    }

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i>Nenhum jogo encontrado.</div>';
      return;
    }

    list.innerHTML = filtered.map(f => {
      const status = API.formatStatus(f);
      const isCruzeiro_home = f.teams.home.id === CONFIG.CRUZEIRO_ID;
      const home = f.teams.home;
      const away = f.teams.away;
      const leagueId = f.league.id;

      const scoreStr = status.done || status.live
        ? `${f.goals.home ?? 0} – ${f.goals.away ?? 0}`
        : `vs`;

      const gameScores = SHEETS.local.getGameScores();
      const fixtureScores = gameScores[f.fixture.id];
      const hasScores = fixtureScores && Object.keys(fixtureScores).length > 0;

      return `
      <div class="jogo-card" data-fixture="${f.fixture.id}">
        <span class="jogo-comp-badge">${CONFIG.COMPETITIONS[leagueId]?.flag || ''} ${API.compName(leagueId)}</span>
        <div class="jogo-teams">
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${home.logo}" alt="${home.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${home.name}</div>
          </div>
          <div class="jogo-placar ${f._live ? 'live' : ''}">${scoreStr}</div>
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${away.logo}" alt="${away.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${away.name}</div>
          </div>
        </div>
        <div class="jogo-date">${API.formatDate(f.fixture.date)}</div>
        <span class="jogo-status-badge ${status.css}">${f._live ? '🔴 AO VIVO' : status.label}</span>
        <div class="jogo-actions">
          ${status.done && AUTH.isLoggedIn()
            ? `<button class="btn btn-sm btn-primary" onclick="APP.openRatingModal(${f.fixture.id})">
                ${hasScores ? '✏️ Reeditar' : '⭐ Avaliar'}
               </button>`
            : ''}
        </div>
      </div>`;
    }).join('');
  },
});

// =============================================
// MODAL DE AVALIAÇÃO POR JOGO
// =============================================

Object.assign(APP, {

  async openRatingModal(fixtureId) {
    if (!AUTH.isLoggedIn()) { showToast('Você precisa estar logado para avaliar.', 'error'); return; }

    const fixture = this.allFixtures.find(f => f.id === fixtureId);
    if (!fixture) return;

    const modal   = document.getElementById('modalAvaliarJogo');
    const title   = document.getElementById('modalAvaliarTitle');
    const content = document.getElementById('modalAvaliarContent');

    const score = API.getScore(fixture);
    title.textContent = `${fixture.homeTeam?.name} ${score.home} × ${score.away} ${fixture.awayTeam?.name}`;

    content.innerHTML = '<div class="loading-spinner"><i class="fas fa-futbol fa-spin"></i></div>';
    modal.classList.add('open');

    // Busca escalação via SofaScore
    const lineupData = await API.getLineup(fixtureId);
    const participated = lineupData?.participated || [];
    const all          = lineupData?.all || [];

    // Notas já dadas por esse usuário
    const username = AUTH.getUsername();
    const savedScores = {};
    const gs = SHEETS.local.getGameScores();
    if (gs[fixtureId]) {
      Object.entries(gs[fixtureId]).forEach(([pid, userScores]) => {
        if (userScores[username] !== undefined) savedScores[pid] = userScores[username];
      });
    }

    this.currentFixtureForRating = { fixtureId, fixture, participated, all };

    // Se não conseguiu escalação, usa o elenco completo
    let playersToShow = participated.length > 0 ? participated : this.squad.map(p => ({
      id: p.id, name: p.name, pos: p.position, played: true, starter: false
    }));

    if (!playersToShow.length) {
      content.innerHTML = '<p class="info-text">Escalação não disponível para este jogo.</p>';
      return;
    }

    content.innerHTML = playersToShow.map(p => {
      const saved = savedScores[p.id] ?? null;
      const photo = getPlayerPhoto(p.name);
      const imgSrc = photo || '';

      return `
      <div class="avaliar-player-card ${saved !== null ? 'rated' : ''}" id="apc-${p.id}">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${p.name}" class="avaliar-player-img"
               onerror="this.src='';this.className='avaliar-player-img'" />`
          : `<div class="avaliar-player-img" style="background:var(--blue-mid);border-radius:50%;display:flex;align-items:center;justify-content:center">
               <i class="fas fa-user" style="font-size:1.5rem;color:var(--gray-400)"></i></div>`
        }
        <div class="avaliar-player-name">${p.name}</div>
        <div class="star-rating" data-player="${p.id}">
          ${[1,2,3,4,5,6,7,8,9,10].map(n =>
            `<button class="star-btn ${saved !== null && n <= saved ? 'active' : ''}"
               data-val="${n}" onclick="APP.setRating(${p.id}, ${n})">★</button>`
          ).join('')}
        </div>
        <input type="number" class="note-input" id="note-${p.id}"
          min="0" max="10" step="0.5"
          value="${saved !== null ? saved : ''}"
          placeholder="0–10"
          onchange="APP.setRatingInput(${p.id}, this.value)" />
      </div>`;
    }).join('');
  },

  setRating(playerId, value) {
    const input = document.getElementById(`note-${playerId}`);
    if (input) input.value = value;
    const card = document.getElementById(`apc-${playerId}`);
    if (card) card.classList.add('rated');
    // Atualiza estrelas
    const stars = document.querySelectorAll(`.star-rating[data-player="${playerId}"] .star-btn`);
    stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= value));
  },

  setRatingInput(playerId, value) {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0 || n > 10) return;
    this.setRating(playerId, Math.round(n));
  },

  async saveGameRatings() {
    if (!this.currentFixtureForRating) return;
    const { fixtureId, fixture, participated } = this.currentFixtureForRating;
    const username = AUTH.getUsername();
    const score    = API.getScore(fixture);
    const home = fixture.homeTeam?.name || '';
    const away = fixture.awayTeam?.name || '';
    const date = API.formatDate(fixture.startTimestamp);

    const playersToScore = participated.length > 0 ? participated : this.squad.map(p => ({
      id: p.id, name: p.name, played: true
    }));

    let saved = 0;
    for (const p of playersToScore) {
      const input = document.getElementById(`note-${p.id}`);
      if (!input) continue;
      const val = input.value !== '' ? parseFloat(input.value) : null;
      if (val === null || isNaN(val)) continue;
      const score = Math.min(10, Math.max(0, val));
      SHEETS.local.submitGameScore(fixtureId, p.id, username, score);
      saved++;

      if (isSheetsConfigured()) {
        await SHEETS.submitGameScore(
          fixtureId, fixture.fixture.date, home, away,
          p.id, p.name, username, score
        );
      }
    }

    document.getElementById('modalAvaliarJogo').classList.remove('open');
    showToast(`${saved} notas salvas!`, 'success');
    if (this.currentPage === 'jogos') this._renderJogos(
      document.querySelector('.jogos-tabs .tab-btn.active')?.dataset.tab || 'anteriores',
      document.querySelector('.filters .filter-btn[data-comp].active')?.dataset.comp || 'all'
    );
  },
});

// =============================================
// RANKINGS
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

    // Agrega todas as notas de todos os jogos por jogador
    const totals = {};

    // Notas principais
    Object.entries(mainScores).forEach(([pid, score]) => {
      if (!totals[pid]) totals[pid] = { scores: [], name: '' };
      totals[pid].scores.push(parseFloat(score));
    });

    // Notas de jogos
    Object.values(gs).forEach(fixture => {
      Object.entries(fixture).forEach(([pid, userScores]) => {
        if (!totals[pid]) totals[pid] = { scores: [], name: '' };
        Object.values(userScores).forEach(s => totals[pid].scores.push(parseFloat(s)));
      });
    });

    const ranked = Object.entries(totals)
      .map(([pid, d]) => ({
        id: pid,
        avg: (d.scores.reduce((a,b)=>a+b,0) / d.scores.length).toFixed(1),
        votes: d.scores.length,
        name: this._getPlayerName(parseInt(pid)),
      }))
      .filter(p => p.name)
      .sort((a,b) => parseFloat(b.avg) - parseFloat(a.avg))
      .slice(0, 10);

    if (!ranked.length) {
      el.innerHTML = '<p class="info-text" style="padding:1rem">Nenhuma nota registrada ainda.</p>';
      return;
    }

    el.innerHTML = ranked.map((p, i) => {
      const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const photo = getPlayerPhoto(p.name);
      return `
      <div class="ranking-item">
        <span class="ranking-pos ${posClass}">${i + 1}º</span>
        ${photo
          ? `<img class="ranking-avatar" src="${photo}" alt="${p.name}" onerror="this.style.display='none'" />`
          : `<div class="ranking-avatar" style="background:var(--blue-mid);display:flex;align-items:center;justify-content:center">
               <i class="fas fa-user" style="color:var(--gray-400)"></i></div>`
        }
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
      const fx = this.allFixtures.find(f => String(f.fixture.id) === String(fid));
      const matchLabel = fx ? `${fx.teams.home.name} × ${fx.teams.away.name}` : `Jogo #${fid}`;

      Object.entries(players).forEach(([pid, userScores]) => {
        const vals = Object.values(userScores).map(Number);
        const avg  = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
        const name = this._getPlayerName(parseInt(pid));
        if (name) best.push({ name, avg, match: matchLabel });
      });
    });

    best.sort((a,b) => parseFloat(b.avg) - parseFloat(a.avg));
    const top = best.slice(0, 10);

    if (!top.length) {
      el.innerHTML = '<p class="info-text" style="padding:1rem">Nenhuma nota de jogo ainda.</p>';
      return;
    }

    el.innerHTML = top.map((p, i) => {
      const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const photo = getPlayerPhoto(p.name);
      return `
      <div class="ranking-item">
        <span class="ranking-pos ${posClass}">${i + 1}º</span>
        ${photo
          ? `<img class="ranking-avatar" src="${photo}" alt="${p.name}" onerror="this.style.display='none'" />`
          : `<div class="ranking-avatar" style="background:var(--blue-mid);display:flex;align-items:center;justify-content:center">
               <i class="fas fa-user" style="color:var(--gray-400)"></i></div>`
        }
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
// AVALIAR (página)
// =============================================

Object.assign(APP, {

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

    const past = this.allFixtures.filter(f =>
      API.formatStatus(f).done && API.isMonitoredComp(f)
    );

    if (!past.length) {
      content.innerHTML = '<p class="info-text">Nenhum jogo finalizado ainda.</p>';
      return;
    }

    content.innerHTML = past.slice().reverse().map(f => {
      const gs = SHEETS.local.getGameScores();
      const myScores = gs[f.id];
      const username = AUTH.getUsername();
      const alreadyRated = myScores && Object.values(myScores).some(s => s[username] !== undefined);
      const score = API.getScore(f);
      const homeLogo = `https://api.sofascore.com/api/v1/team/${f.homeTeam?.id}/image`;
      const awayLogo = `https://api.sofascore.com/api/v1/team/${f.awayTeam?.id}/image`;

      return `
      <div class="jogo-card">
        <span class="jogo-comp-badge">${API.compFlag(f)} ${API.compName(f)}</span>
        <div class="jogo-teams">
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${homeLogo}" alt="${f.homeTeam?.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.homeTeam?.name || '—'}</div>
          </div>
          <div class="jogo-placar">${score.home} – ${score.away}</div>
          <div class="jogo-team">
            <img class="jogo-team-logo" src="${awayLogo}" alt="${f.awayTeam?.name}" onerror="this.style.display='none'" />
            <div class="jogo-team-name">${f.awayTeam?.name || '—'}</div>
          </div>
        </div>
        <div class="jogo-date">${API.formatDate(f.startTimestamp)}</div>
        <div class="jogo-actions">
          <button class="btn btn-sm btn-primary" onclick="APP.openRatingModal(${f.id})">
            ${alreadyRated ? '✏️ Editar notas' : '⭐ Dar notas'}
          </button>
        </div>
      </div>`;
    }).join('');
  },
});

// =============================================
// ADMIN
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
    const el = document.getElementById(`admin-${tab}`);
    if (el) el.classList.add('active-tab');

    if (tab === 'pendentes')  this._loadPendentes();
    if (tab === 'usuarios')   this._loadUsuarios();
    if (tab === 'notas')      this._loadNotasAdmin();
  },

  _loadPendentes() {
    const users = SHEETS.local.getUsers();
    const pending = users.filter(u => u.status === 'pending');
    const el = document.getElementById('pendentesList');

    if (!pending.length) {
      el.innerHTML = '<p class="info-text">Nenhum cadastro pendente.</p>';
      return;
    }

    el.innerHTML = pending.map(u => `
      <div class="pending-item" id="pend-${u.username}">
        <div class="pending-info">
          <div class="pending-name">${u.username} <span class="badge-pending">Pendente</span></div>
          <div class="pending-email">${u.email}</div>
          <div style="font-size:0.75rem;color:var(--gray-400)">
            Solicitado em ${new Date(u.createdAt).toLocaleDateString('pt-BR')}
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn btn-sm btn-success" onclick="APP.approveUser('${u.username}')">
            <i class="fas fa-check"></i> Aprovar
          </button>
          <button class="btn btn-sm btn-danger" onclick="APP.rejectUser('${u.username}')">
            <i class="fas fa-times"></i> Recusar
          </button>
        </div>
      </div>
    `).join('');
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
    const el = document.getElementById('usuariosList');

    if (!users.length) {
      el.innerHTML = '<p class="info-text">Nenhum usuário ativo.</p>';
      return;
    }

    el.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="user-info">
          <div class="user-name">
            ${u.username}
            ${u.role === 'admin' ? '<span class="badge-admin">ADMIN</span>' : ''}
          </div>
          <div class="user-email">${u.email}</div>
        </div>
      </div>
    `).join('');
  },

  _loadNotasAdmin() {
    const el = document.getElementById('notasAdminList');
    if (!this.squad.length) {
      el.innerHTML = '<p class="info-text">Carregue o elenco primeiro.</p>';
      return;
    }

    const mainScores = SHEETS.local.getMainScores();

    el.innerHTML = this.squad.map(p => {
      const score = mainScores[p.id] ?? '';
      return `
      <div class="player-card">
        <div class="player-img-wrap">${playerImgHTML(p.name, p.photo)}</div>
        <div class="player-info">
          <div class="player-name">${p.name}</div>
          <div class="player-pos">${translatePos(p.position)}</div>
          <div class="player-score" style="margin-top:0.5rem;gap:0.5rem">
            <input type="number" class="note-input" id="adm-note-${p.id}"
              min="0" max="10" step="0.5" value="${score}" placeholder="—"
              style="width:65px" />
            <button class="btn btn-sm btn-primary"
              onclick="APP.saveMainScore(${p.id}, '${p.name}')">OK</button>
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
// EVENT LISTENERS & INICIALIZAÇÃO
// =============================================

document.addEventListener('DOMContentLoaded', () => {

  // ── Auth ──
  AUTH.init();

  // ── Navegação ──
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      APP.navigate(link.dataset.page);
    });
  });

  // ── Login modal ──
  document.getElementById('btnLogin').addEventListener('click', () => {
    document.getElementById('modalLogin').classList.add('open');
  });
  document.getElementById('closeLogin').addEventListener('click', () => {
    document.getElementById('modalLogin').classList.remove('open');
  });

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

  // ── Cadastro modal ──
  document.getElementById('btnRegister').addEventListener('click', () => {
    document.getElementById('modalRegister').classList.add('open');
  });
  document.getElementById('closeRegister').addEventListener('click', () => {
    document.getElementById('modalRegister').classList.remove('open');
  });

  document.getElementById('formRegister').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl  = document.getElementById('regError');
    const succEl = document.getElementById('regSuccess');
    errEl.textContent  = '';
    succEl.textContent = '';
    const user  = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass  = document.getElementById('regPass').value;
    const res   = await AUTH.register(user, email, pass);
    if (!res.ok) { errEl.textContent = res.error; return; }
    succEl.textContent = res.message || 'Cadastro solicitado! Aguarde aprovação.';
    document.getElementById('formRegister').reset();
  });

  // ── Logout ──
  document.getElementById('btnLogout').addEventListener('click', () => AUTH.logout());

  // ── Fechar modais ao clicar fora ──
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // ── Salvar notas do jogo ──
  document.getElementById('btnSalvarNotas').addEventListener('click', () => APP.saveGameRatings());

  // ── Fechar modal avaliação ──
  document.getElementById('closeAvaliarJogo').addEventListener('click', () => {
    document.getElementById('modalAvaliarJogo').classList.remove('open');
  });

  // ── Fechar modal nota principal ──
  document.getElementById('closeNotaPrincipal').addEventListener('click', () => {
    document.getElementById('modalNotaPrincipal').classList.remove('open');
  });

  // ── Página inicial ──
  APP.navigate('elenco');

  // ── Atualiza ao vivo a cada 60s ──
  setInterval(async () => {
    const live = this.allFixtures.filter(f => API.formatStatus(f).live);
    if (live.length > 0 && APP.currentPage === 'jogos') {
      // Limpa cache dos jogos ao vivo para forçar atualização
      live.forEach(f => {
        delete CACHE[`${API.SOFA_BASE}/team/${CONFIG.CRUZEIRO_SOFA_ID}/events/last/0`];
      });
      APP.loadJogos();
    }
  }, 60000);
});
