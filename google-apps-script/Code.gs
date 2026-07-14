// =============================================
// JEANSCORE – GOOGLE APPS SCRIPT (Backend)
// Cole este código em: script.google.com
// Crie um novo projeto e cole todo o conteúdo
// Depois: Implantar > Novo Deployment > Web App
// Acesso: Qualquer pessoa | Execute como: Você
// =============================================

const SPREADSHEET_ID = '1CLue7IZVEzfN_QqA4PAnJCoyYSU3smv2fduQCHd73no';

const SHEETS_NAMES = {
  USERS:        'Usuarios',
  MAIN_SCORES:  'NotasPrincipais',
  GAME_SCORES:  'NotasJogos',
};

// ── Entry point POST ──
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    const handlers = {
      getUsers:        () => getUsers(),
      registerUser:    () => registerUser(payload),
      loginUser:       () => loginUser(payload),
      approveUser:     () => approveUser(payload),
      rejectUser:      () => rejectUser(payload),
      getMainScores:   () => getMainScores(),
      setMainScore:    () => setMainScore(payload),
      getGameScores:   () => getGameScores(payload),
      submitGameScore: () => submitGameScore(payload),
      getUserGameScores: () => getUserGameScores(payload),
      updateUserHash:  () => updateUserHash(payload),
      getSquad:        () => getSofaSquad(),
      refreshSquad:    () => refreshSofaSquad(),
      addPlayer:       () => addPlayerToSquad(payload),
      removePlayer:    () => removePlayerFromSquad(payload),
      getFixtures:     () => getFixtures(),
      refreshFixtures: () => refreshFixtures(),
      getLineup:       () => getLineup(payload),
      saveNotaPermanente: () => saveNotaPermanente(payload),
      getNotasPermanentes: () => getNotasPermanentes(payload),
    };

    if (!handlers[action]) return jsonResponse({ ok: false, error: 'Ação inválida' });
    return jsonResponse(handlers[action]());
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ── Entry point GET (para testes) ──
function doGet(e) {
  return jsonResponse({ ok: true, message: 'JeanScore API online' });
}

// ── Roda uma vez para criar o admin inicial ──
// Execute manualmente no Apps Script: Executar > setupAdmin
function setupAdmin() {
  const sheet = getSheet(SHEETS_NAMES.USERS);
  const data  = sheet.getDataRange().getValues();

  // Hash SHA-256 de "jean2025" — mesmo algoritmo do browser (Web Crypto API)
  const passHash = computeSHA256('jean2025');

  // Verifica se admin já existe — atualiza o hash se necessário
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'Jean') {
      sheet.getRange(i + 1, 3).setValue(passHash);
      Logger.log('Hash do admin atualizado: ' + passHash);
      return;
    }
  }

  // Cria novo admin
  sheet.appendRow(['Jean', 'jean.honorato.bh@gmail.com', passHash, 'admin', 'approved', new Date().toISOString()]);
  Logger.log('Admin criado! Hash: ' + passHash);
}

function computeSHA256(message) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Helper: pega ou cria aba ──
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheet(sheet, name);
  }
  return sheet;
}

function initSheet(sheet, name) {
  const headers = {
    Usuarios:       ['username','email','passHash','role','status','createdAt'],
    NotasPrincipais:['playerId','playerName','score','votes','updatedAt','setBy'],
    NotasJogos:     ['fixtureId','fixtureDate','homeTeam','awayTeam','playerId','playerName','username','score','createdAt'],
  };
  if (headers[name]) {
    sheet.appendRow(headers[name]);
    sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold');
  }
}

// =============================================
// USUÁRIOS
// =============================================

function getUsers() {
  const sheet = getSheet(SHEETS_NAMES.USERS);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, users: [] };
  const [headers, ...rows] = data;
  const users = rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    obj.passHash = undefined; // não retorna hash
    return obj;
  });
  return { ok: true, users };
}

function registerUser({ username, email, passHash }) {
  const sheet = getSheet(SHEETS_NAMES.USERS);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) return { ok: false, error: 'Nome de usuário já existe' };
    if (data[i][1] === email)    return { ok: false, error: 'E-mail já cadastrado' };
  }

  sheet.appendRow([username, email, passHash, 'user', 'pending', new Date().toISOString()]);
  return { ok: true, message: 'Cadastro solicitado! Aguarde aprovação do admin.' };
}

function loginUser({ username, passHash }) {
  const sheet = getSheet(SHEETS_NAMES.USERS);
  const data  = sheet.getDataRange().getValues();
  const [headers, ...rows] = data;

  for (const row of rows) {
    if (row[0] === username && row[2] === passHash) {
      const status = row[4];
      if (status === 'pending')  return { ok: false, error: 'Cadastro ainda não aprovado' };
      if (status === 'rejected') return { ok: false, error: 'Cadastro recusado' };
      return { ok: true, user: { username: row[0], email: row[1], role: row[3] } };
    }
  }
  return { ok: false, error: 'Usuário ou senha incorretos' };
}

function approveUser({ username }) {
  return _updateUserStatus(username, 'approved');
}

function rejectUser({ username }) {
  return _updateUserStatus(username, 'rejected');
}

function _updateUserStatus(username, status) {
  const sheet = getSheet(SHEETS_NAMES.USERS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 5).setValue(status);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Usuário não encontrado' };
}

function updateUserHash({ username, passHash }) {
  const sheet = getSheet(SHEETS_NAMES.USERS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 3).setValue(passHash);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Usuário não encontrado' };
}

// =============================================
// ELENCO (via proxy Apps Script → SofaScore)
// =============================================

function getSofaSquad() {
  const sheet = getSheet('Elenco');
  const data  = sheet.getDataRange().getValues();

  // Retorna cache da planilha se tiver dados frescos (menos de 24h)
  if (data.length > 1) {
    const lastUpdate = data[1][6]; // coluna updatedAt
    if (lastUpdate && (new Date() - new Date(lastUpdate)) < 24 * 60 * 60 * 1000) {
      const [headers, ...rows] = data;
      return { ok: true, players: rows.map(r => ({
        id: r[0], name: r[1], position: r[2], number: r[3], photo: r[4], nationality: r[5]
      }))};
    }
  }

  // Busca no SofaScore
  return refreshSofaSquad();
}

function debugSquad() {
  try {
    Logger.log('Iniciando fetch SofaScore...');
    const res = UrlFetchApp.fetch('https://api.sofascore.com/api/v1/team/1954/players', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.sofascore.com/',
      },
      muteHttpExceptions: true,
    });
    Logger.log('HTTP Code: ' + res.getResponseCode());
    const text = res.getContentText();
    Logger.log('Resposta (primeiros 500): ' + text.substring(0, 500));
    const data = JSON.parse(text);
    Logger.log('Jogadores encontrados: ' + (data.players ? data.players.length : 0));
  } catch(e) {
    Logger.log('ERRO: ' + e.message);
  }
}

function refreshSofaSquad() {
  try {
    // API-Football não bloqueia requests do Google Apps Script
    const res = UrlFetchApp.fetch(
      'https://v3.football.api-sports.io/players/squads?team=135', {
      headers: {
        'x-apisports-key': '477d6449d7eb1e2a6722e67624eb4b99',
      },
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      return { ok: false, error: `HTTP ${res.getResponseCode()}` };
    }

    const data = JSON.parse(res.getContentText());
    if (!data.response || !data.response[0]) return { ok: false, error: 'Sem dados' };

    const players = data.response[0].players.map(p => ({
      id:          p.id,
      name:        p.name,
      position:    p.position || '',
      number:      p.number || '',
      photo:       p.photo || `https://media.api-sports.io/football/players/${p.id}.png`,
      nationality: p.nationality || '',
      manual:      false,
    }));

    const sheet = getSheet('Elenco');
    const existing = sheet.getDataRange().getValues();

    // Preserva jogadores marcados como manuais (coluna 7 = 'manual')
    const manualPlayers = [];
    if (existing.length > 1) {
      const [headers, ...rows] = existing;
      rows.forEach(r => {
        if (r[6] === true || r[6] === 'TRUE' || r[6] === 'true') {
          manualPlayers.push({
            id: r[0], name: r[1], position: r[2],
            number: r[3], photo: r[4], nationality: r[5], manual: true
          });
        }
      });
    }

    // Combina: API-Football + manuais que não estejam duplicados
    const apiIds = new Set(players.map(p => String(p.id)));
    const toKeep = manualPlayers.filter(m => !apiIds.has(String(m.id)));
    const allPlayers = [...players, ...toKeep];

    // Reescreve a aba
    sheet.clearContents();
    sheet.appendRow(['id','name','position','number','photo','nationality','updatedAt','manual']);
    const now = new Date().toISOString();
    allPlayers.forEach(p => sheet.appendRow([
      p.id, p.name, p.position, p.number, p.photo, p.nationality, now, p.manual || false
    ]));

    return { ok: true, players: allPlayers };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function addPlayerToSquad({ id, name, position, number, photo, nationality }) {
  const sheet = getSheet('Elenco');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return { ok: false, error: 'Jogador já existe' };
  }
  const now = new Date().toISOString();
  sheet.appendRow([id, name, position || '', number || '', photo || '', nationality || '', now, true]);
  return { ok: true };
}

function removePlayerFromSquad({ id }) {
  const sheet = getSheet('Elenco');
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      // Só remove se for manual
      if (data[i][7] === true || data[i][7] === 'TRUE' || data[i][7] === 'true') {
        sheet.deleteRow(i + 1);
        return { ok: true };
      } else {
        return { ok: false, error: 'Não é possível remover jogadores da API' };
      }
    }
  }
  return { ok: false, error: 'Jogador não encontrado' };
}

// Trigger diário — configure em: Gatilhos > Adicionar gatilho > refreshSofaSquad > Diário
function setupDailyTrigger() {
  // Remove triggers existentes do refreshSofaSquad
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshSofaSquad')
    .forEach(t => ScriptApp.deleteTrigger(t));
  // Cria novo trigger diário às 6h
  ScriptApp.newTrigger('refreshSofaSquad')
    .timeBased().everyDays(1).atHour(6).create();
  Logger.log('Trigger diário configurado!');
}

function getMainScores() {
  const sheet = getSheet(SHEETS_NAMES.MAIN_SCORES);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, scores: {} };

  const scores = {};
  for (let i = 1; i < data.length; i++) {
    const [playerId,, score, votes] = data[i];
    scores[playerId] = { avg: parseFloat(score), votes: parseInt(votes) || 1 };
  }
  return { ok: true, scores };
}

function setMainScore({ playerId, playerName, score, setBy }) {
  const sheet = getSheet(SHEETS_NAMES.MAIN_SCORES);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(playerId)) {
      const oldScore = parseFloat(data[i][2]) || 0;
      const oldVotes = parseInt(data[i][3]) || 0;
      const newVotes = oldVotes + 1;
      const newAvg   = ((oldScore * oldVotes) + parseFloat(score)) / newVotes;
      sheet.getRange(i + 1, 3).setValue(newAvg.toFixed(2));
      sheet.getRange(i + 1, 4).setValue(newVotes);
      sheet.getRange(i + 1, 5).setValue(new Date().toISOString());
      sheet.getRange(i + 1, 6).setValue(setBy);
      return { ok: true };
    }
  }

  // Novo
  sheet.appendRow([playerId, playerName, parseFloat(score), 1, new Date().toISOString(), setBy]);
  return { ok: true };
}

// =============================================
// NOTAS POR JOGO
// =============================================

function getGameScores({ fixtureId }) {
  const sheet = getSheet(SHEETS_NAMES.GAME_SCORES);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, scores: [] };

  const [headers, ...rows] = data;
  const scores = rows
    .filter(r => String(r[0]) === String(fixtureId))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });

  // Agrega por jogador
  const byPlayer = {};
  scores.forEach(s => {
    if (!byPlayer[s.playerId]) byPlayer[s.playerId] = { playerName: s.playerName, scores: [] };
    byPlayer[s.playerId].scores.push(parseFloat(s.score));
  });

  const aggregated = Object.entries(byPlayer).map(([pid, d]) => ({
    playerId: pid,
    playerName: d.playerName,
    avg: (d.scores.reduce((a,b)=>a+b,0) / d.scores.length).toFixed(1),
    votes: d.scores.length,
  }));

  return { ok: true, scores: aggregated };
}

function submitGameScore({ fixtureId, fixtureDate, homeTeam, awayTeam, playerId, playerName, username, score }) {
  const sheet = getSheet(SHEETS_NAMES.GAME_SCORES);
  const data  = sheet.getDataRange().getValues();

  // Remove nota anterior desse usuário para esse jogador nesse jogo
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(fixtureId) &&
        String(data[i][4]) === String(playerId)  &&
        data[i][6] === username) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(r => sheet.deleteRow(r));

  sheet.appendRow([fixtureId, fixtureDate, homeTeam, awayTeam,
    playerId, playerName, username, parseFloat(score), new Date().toISOString()]);

  return { ok: true };
}

function getUserGameScores({ fixtureId, username }) {
  const sheet = getSheet(SHEETS_NAMES.GAME_SCORES);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, scores: {} };

  const [headers, ...rows] = data;
  const myScores = {};
  rows
    .filter(r => String(r[0]) === String(fixtureId) && r[6] === username)
    .forEach(r => { myScores[r[4]] = parseFloat(r[7]); });

  return { ok: true, scores: myScores };
}

// =============================================
// JOGOS E ESCALAÇÕES (proxy SofaScore)
// =============================================

const SOFA_HEADERS_GAS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
};

function sofaFetch(path) {
  try {
    const res = UrlFetchApp.fetch('https://api.sofascore.com/api/v1' + path, {
      headers: SOFA_HEADERS_GAS,
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return null;
    return JSON.parse(res.getContentText());
  } catch(e) {
    Logger.log('sofaFetch error: ' + e.message);
    return null;
  }
}

function debugFixtures() {
  const url = 'https://api.sofascore.com/api/v1/team/1954/events/last/0';
  const res = UrlFetchApp.fetch(url, {
    headers: SOFA_HEADERS_GAS,
    muteHttpExceptions: true,
  });
  Logger.log('HTTP Code: ' + res.getResponseCode());
  Logger.log('Resposta: ' + res.getContentText().substring(0, 300));
}

function refreshFixtures() {
  try {
    const [last0, last1, last2, next0] = [
      sofaFetch('/team/1954/events/last/0'),
      sofaFetch('/team/1954/events/last/1'),
      sofaFetch('/team/1954/events/last/2'),
      sofaFetch('/team/1954/events/next/0'),
    ];

    const all = [
      ...(last2?.events || []),
      ...(last1?.events || []),
      ...(last0?.events || []),
      ...(next0?.events || []),
    ];

    // Remove duplicatas
    const seen = new Set();
    const unique = all.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    // Competições monitoradas
    const MONITORED = ['Brasileirão','Serie A','Copa do Brasil','Libertadores','CONMEBOL','Mineiro','Friendly'];
    const filtered = unique.filter(f => {
      const name = f.tournament?.name || '';
      return MONITORED.some(m => name.toLowerCase().includes(m.toLowerCase()));
    });

    // Salva na planilha
    const sheet = getSheet('Jogos');
    sheet.clearContents();
    sheet.appendRow(['id','homeTeam','homeTeamId','awayTeam','awayTeamId',
      'homeScore','awayScore','status','timestamp','tournament','updatedAt']);

    const now = new Date().toISOString();
    filtered.forEach(f => {
      sheet.appendRow([
        f.id,
        f.homeTeam?.name || '',
        f.homeTeam?.id || '',
        f.awayTeam?.name || '',
        f.awayTeam?.id || '',
        f.homeScore?.current ?? '',
        f.awayScore?.current ?? '',
        f.status?.type || '',
        f.startTimestamp || '',
        f.tournament?.name || '',
        now,
      ]);
    });

    return { ok: true, count: filtered.length };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

function getFixtures() {
  const sheet = getSheet('Jogos');
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    // Se não tem dados, busca agora
    const refresh = refreshFixtures();
    if (!refresh.ok) return { ok: false, error: refresh.error };
    return getFixtures(); // recursivo após refresh
  }

  const [headers, ...rows] = data;
  const fixtures = rows.map(r => ({
    id:          r[0],
    homeTeam:    { name: r[1], id: r[2] },
    awayTeam:    { name: r[3], id: r[4] },
    homeScore:   { current: r[5] !== '' ? r[5] : null },
    awayScore:   { current: r[6] !== '' ? r[6] : null },
    status:      { type: r[7] },
    startTimestamp: r[8],
    tournament:  { name: r[9] },
  }));

  return { ok: true, fixtures };
}

function getLineup({ fixtureId }) {
  try {
    const data = sofaFetch('/event/' + fixtureId + '/lineups');
    if (!data) return { ok: false, error: 'Sem dados de escalação' };

    // Descobre qual time é o Cruzeiro
    const cruzTeam = (data.home?.team?.name || '').toLowerCase().includes('cruzeiro')
      ? data.home : data.away;
    if (!cruzTeam?.players) return { ok: true, participated: [], all: [] };

    const participated = [];
    const all = [];

    cruzTeam.players.forEach(p => {
      const player = {
        id:      p.player.id,
        name:    p.player.name,
        pos:     p.player.position || '',
        number:  p.jerseyNumber || '',
        played:  !p.substitute,
        starter: !p.substitute,
      };
      all.push(player);
      if (!p.substitute) participated.push(player);

      // Verifica minutos jogados para substitutos
      if (p.substitute) {
        const mins = p.statistics?.minutesPlayed;
        if (mins && mins > 0) {
          player.played = true;
          participated.push(player);
        }
      }
    });

    return { ok: true, participated, all };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// =============================================
// NOTAS PERMANENTES
// =============================================

function saveNotaPermanente({ playerId, playerName, username, year, nota }) {
  const sheetName = `NotasPermanentes${year}`;
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();

  // Verifica se usuário já votou nesse jogador nesse ano
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(playerId) && data[i][2] === username) {
      return { ok: false, error: 'Você já deu nota permanente para este jogador este ano.' };
    }
  }

  sheet.appendRow([playerId, playerName, username, parseFloat(nota), year, new Date().toISOString()]);
  return { ok: true };
}

function getNotasPermanentes({ year }) {
  const sheetName = `NotasPermanentes${year}`;
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, scores: {} };

  const [headers, ...rows] = data;

  // Agrega por jogador: média de todas as notas
  const byPlayer = {};
  rows.forEach(r => {
    const pid   = String(r[0]);
    const nota  = parseFloat(r[3]);
    const user  = r[2];
    if (!byPlayer[pid]) byPlayer[pid] = { name: r[1], notes: [], users: {} };
    byPlayer[pid].notes.push(nota);
    byPlayer[pid].users[user] = nota;
  });

  const scores = {};
  Object.entries(byPlayer).forEach(([pid, d]) => {
    const avg = (d.notes.reduce((a, b) => a + b, 0) / d.notes.length).toFixed(1);
    scores[pid] = { avg: parseFloat(avg), votes: d.notes.length, byUser: d.users };
  });

  return { ok: true, scores };
}
