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
      updatePlayer:    () => updatePlayerInSquad(payload),
      getFixtures:     () => getJogosTemporada(),
      refreshFixtures: () => saveJogosTemporada(),
      getLineup:       () => getLineup(payload),
      updateJogoLiberado: () => updateJogoLiberado(payload),
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
  // Usa dados oficiais do Cruzeiro (cruzeiro.com.br) - julho/2026
  const cruzPlayers = getCruzeiroSquadData();
  return saveSquadToSheet(cruzPlayers);
}

function fetchCruzeiroSquad() {
  try {
    const res = UrlFetchApp.fetch('https://www.cruzeiro.com.br/categoria/masculino', {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    if (res.getResponseCode() !== 200) return { ok: false };

    const html = res.getContentText();

    // Extrai fotos do padrão imagens.cruzeiro.com.br
    const photoRegex = /https:\/\/imagens\.cruzeiro\.com\.br\/Elenco\/2026\/Masculino\/Thumb\/([^"'\s]+\.png)/g;
    const photos = [];
    let m;
    while ((m = photoRegex.exec(html)) !== null) {
      photos.push('https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/' + m[1]);
    }

    if (photos.length === 0) return { ok: false };

    // Usa dados hard-coded do site (extraídos manualmente - atualizados em julho/2026)
    return { ok: true, players: getCruzeiroSquadData() };
  } catch(e) {
    Logger.log('fetchCruzeiroSquad error: ' + e.message);
    return { ok: false };
  }
}

function getCruzeiroSquadData() {
  // Elenco oficial extraído de cruzeiro.com.br em julho/2026
  return [
    {id:'crz_1',  name:'Cássio',          position:'Goalkeeper', number:'1',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Cassio-01.png',          nationality:'Brazil',    manual:false},
    {id:'crz_81', name:'Otávio',           position:'Goalkeeper', number:'81', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Otavio-01.png',          nationality:'Brazil',    manual:false},
    {id:'crz_41', name:'Léo Aragão',       position:'Goalkeeper', number:'41', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Leo-Aragao-01.png',      nationality:'Brazil',    manual:false},
    {id:'crz_31', name:'Matheus Cunha',    position:'Goalkeeper', number:'31', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Matheus-Cunha-01.png',   nationality:'Brazil',    manual:false},
    {id:'crz_24', name:'Marcelo Eráclito', position:'Goalkeeper', number:'24', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Marcelo-01.png',         nationality:'Brazil',    manual:false},
    {id:'crz_51', name:'Vitor Lamounier',  position:'Goalkeeper', number:'51', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Vitor-Lamounier-01.png', nationality:'Brazil',    manual:false},
    {id:'crz_15', name:'Fabrício Bruno',   position:'Defender',   number:'15', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Fabricio-Bruno-01.png',  nationality:'Brazil',    manual:false},
    {id:'crz_25', name:'Lucas Villalba',   position:'Defender',   number:'25', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Lucas-Villalba-01.png',  nationality:'Uruguay',   manual:false},
    {id:'crz_34', name:'Jonathan Jesus',   position:'Defender',   number:'34', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Jonathan-Jesus-01.png',  nationality:'Brazil',    manual:false},
    {id:'crz_43', name:'João Marcelo',     position:'Defender',   number:'43', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Joao-Marcelo-01.png',    nationality:'Brazil',    manual:false},
    {id:'crz_12', name:'William',          position:'Defender',   number:'12', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/William-01.png',         nationality:'Brazil',    manual:false},
    {id:'crz_23', name:'Fágner',           position:'Defender',   number:'23', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Fagner-01.png',          nationality:'Brazil',    manual:false},
    {id:'crz_2',  name:'Kauã Moraes',      position:'Defender',   number:'2',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Kaua-Moraes-01.png',     nationality:'Brazil',    manual:false},
    {id:'crz_27', name:'Rojas',            position:'Defender',   number:'27', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Gabriel-Rojas-02.png',   nationality:'Colombia',  manual:false},
    {id:'crz_29', name:'Lucas Romero',     position:'Midfielder', number:'29', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Lucas-Romero-01.png',    nationality:'Argentina', manual:false},
    {id:'crz_16', name:'Lucas Silva',      position:'Midfielder', number:'16', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Lucas-Silva-01.png',     nationality:'Brazil',    manual:false},
    {id:'crz_8',  name:'Matheus Henrique', position:'Midfielder', number:'8',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Matheus-Henrique-01.png',nationality:'Brazil',    manual:false},
    {id:'crz_11', name:'Gerson',           position:'Midfielder', number:'11', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Gerson-01.png',          nationality:'Brazil',    manual:false},
    {id:'crz_35', name:'Murilo Rhikman',   position:'Midfielder', number:'35', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Murilo-Rhikman-01.png',  nationality:'Brazil',    manual:false},
    {id:'crz_40', name:'Rhuan Gabriel',    position:'Midfielder', number:'40', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Rhuan-Gabriel-01.png',   nationality:'Brazil',    manual:false},
    {id:'crz_10', name:'Matheus Pereira',  position:'Attacker',   number:'10', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Matheus-Pereira-01.png', nationality:'Brazil',    manual:false},
    {id:'crz_19', name:'Kaio Jorge',       position:'Attacker',   number:'19', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Kaio-Jorge-01.png',      nationality:'Brazil',    manual:false},
    {id:'crz_94', name:'Wanderson',        position:'Attacker',   number:'94', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Wanderson-01.png',       nationality:'Brazil',    manual:false},
    {id:'crz_99', name:'Arroyo',           position:'Attacker',   number:'99', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Keny-Arroyo-01.png',     nationality:'Ecuador',   manual:false},
    {id:'crz_17', name:'Sinisterra',       position:'Attacker',   number:'17', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Sinisterra-01.png',      nationality:'Colombia',  manual:false},
    {id:'crz_77', name:'Gabriel Pec',      position:'Attacker',   number:'77', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Gabriel-Pec-01.png',     nationality:'Brazil',    manual:false},
    {id:'crz_9',  name:'Bruno Rodrigues',  position:'Attacker',   number:'9',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Bruno-Rodrigues-01.png', nationality:'Brazil',    manual:false},
    {id:'crz_7',  name:'Marquinhos',       position:'Attacker',   number:'7',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Marquinhos-01.png',      nationality:'Brazil',    manual:false},
    {id:'crz_70', name:'Kaique Kenji',     position:'Attacker',   number:'70', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Kaique-Kenji-01.png',    nationality:'Brazil',    manual:false},
    {id:'crz_22', name:'Néiser Villarreal',position:'Attacker',   number:'22', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Neiser-Villalrreal-01.png',nationality:'Venezuela',manual:false},
    {id:'crz_91', name:'Chico da Costa',   position:'Attacker',   number:'91', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Chico-da-Costa-01.png',  nationality:'Brazil',    manual:false},
    {id:'crz_57', name:'Rayan Lelis',      position:'Attacker',   number:'57', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Rayan-Lelis-01.png',     nationality:'Brazil',    manual:false},
  ];
}

function saveSquadToSheet(players) {
  const sheet = getSheet('Elenco');
  const existing = sheet.getDataRange().getValues();

  // Preserva jogadores manuais
  const manualPlayers = [];
  if (existing.length > 1) {
    const [, ...rows] = existing;
    rows.forEach(r => {
      if (r[7] === true || r[7] === 'TRUE' || r[7] === 'true') {
        const alreadyIn = players.some(p => String(p.id) === String(r[0]));
        if (!alreadyIn) {
          manualPlayers.push({ id:r[0], name:r[1], position:r[2], number:r[3], photo:r[4], nationality:r[5], manual:true });
        }
      }
    });
  }

  const allPlayers = [...players, ...manualPlayers];
  sheet.clearContents();
  sheet.appendRow(['id','name','position','number','photo','nationality','updatedAt','manual']);
  const now = new Date().toISOString();
  allPlayers.forEach(p => sheet.appendRow([p.id, p.name, p.position, p.number, p.photo, p.nationality, now, p.manual || false]));

  return { ok: true, players: allPlayers };
}

function updatePlayerInSquad({ id, name, position, number, photo, nationality }) {
  const sheet = getSheet('Elenco');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 2).setValue(name || data[i][1]);
      sheet.getRange(i + 1, 3).setValue(position || data[i][2]);
      sheet.getRange(i + 1, 4).setValue(number !== undefined ? number : data[i][3]);
      sheet.getRange(i + 1, 5).setValue(photo || data[i][4]);
      sheet.getRange(i + 1, 6).setValue(nationality || data[i][5]);
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      return { ok: true };
    }
  }
  return { ok: false, error: 'Jogador não encontrado' };
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

// =============================================
// JOGOS OFICIAIS DA TEMPORADA 2026
// =============================================

function getJogosTemporada() {
  const sheet = getSheet('Jogos2026');
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, jogos: [] };

  const [, ...rows] = data;
  const jogos = rows.map(r => ({
    id:        r[0],
    home:      r[1],
    away:      r[2],
    homeScore: r[3] !== '' ? r[3] : null,
    awayScore: r[4] !== '' ? r[4] : null,
    date:      r[5],
    timestamp: r[6],
    comp:      r[7],
    stadium:   r[8],
    status:    r[9],
    liberado:  r[10] === true || r[10] === 'TRUE',
  }));
  return { ok: true, jogos };
}

function saveJogosTemporada() {
  const jogos = getCruzeiroJogos2026();
  const sheet = getSheet('Jogos2026');
  sheet.clearContents();
  sheet.appendRow(['id','home','away','homeScore','awayScore','date','timestamp','comp','stadium','status','liberado']);
  jogos.forEach(j => sheet.appendRow([
    j.id, j.home, j.away,
    j.homeScore !== null ? j.homeScore : '',
    j.awayScore !== null ? j.awayScore : '',
    j.date, j.timestamp, j.comp, j.stadium, j.status, j.liberado
  ]));
  return { ok: true, count: jogos.length };
}

function updateJogoLiberado({ jogoId, liberado }) {
  const sheet = getSheet('Jogos2026');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === jogoId) {
      sheet.getRange(i + 1, 11).setValue(liberado);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Jogo não encontrado' };
}

function getCruzeiroJogos2026() {
  // Temporada completa 2026 extraída de cruzeiro.com.br em julho/2026
  const now = Date.now() / 1000;
  function ts(dateStr) {
    try { return Math.floor(new Date(dateStr).getTime() / 1000); } catch(e) { return 0; }
  }
  function status(t, hs, as) {
    if (hs === null) return t > 0 && t < now ? 'finished' : 'notstarted';
    return 'finished';
  }

  const jogos = [
    // JANEIRO
    {id:'j01', home:'Cruzeiro',  away:'Pouso Alegre', homeScore:1, awayScore:2, date:'2026-01-10T22:30', comp:'Campeonato Mineiro',    stadium:'Mineirão'},
    {id:'j02', home:'Tombense',  away:'Cruzeiro',     homeScore:1, awayScore:2, date:'2026-01-15T01:30', comp:'Campeonato Mineiro',    stadium:'Parque do Sabiá'},
    {id:'j03', home:'Cruzeiro',  away:'Uberlândia',   homeScore:5, awayScore:0, date:'2026-01-17T22:30', comp:'Campeonato Mineiro',    stadium:'Mineirão'},
    {id:'j04', home:'Cruzeiro',  away:'Democrata-GV', homeScore:0, awayScore:1, date:'2026-01-22T22:30', comp:'Campeonato Mineiro',    stadium:'Mineirão'},
    {id:'j05', home:'Atlético-MG', away:'Cruzeiro',   homeScore:2, awayScore:1, date:'2026-01-25T22:00', comp:'Campeonato Mineiro',    stadium:'Arena MRV'},
    {id:'j06', home:'Botafogo',  away:'Cruzeiro',     homeScore:4, awayScore:0, date:'2026-01-30T01:30', comp:'Campeonato Brasileiro', stadium:'Nilton Santos'},
    // FEVEREIRO
    {id:'j07', home:'Betim',     away:'Cruzeiro',     homeScore:0, awayScore:1, date:'2026-02-02T00:00', comp:'Campeonato Mineiro',    stadium:'Arena URBSAN'},
    {id:'j08', home:'Cruzeiro',  away:'Coritiba',     homeScore:1, awayScore:2, date:'2026-02-06T01:30', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j09', home:'Cruzeiro',  away:'América-MG',   homeScore:2, awayScore:0, date:'2026-02-08T22:00', comp:'Campeonato Mineiro',    stadium:'Mineirão'},
    {id:'j10', home:'Mirassol',  away:'Cruzeiro',     homeScore:2, awayScore:2, date:'2026-02-11T23:00', comp:'Campeonato Brasileiro', stadium:'Maião'},
    {id:'j11', home:'URT',       away:'Cruzeiro',     homeScore:1, awayScore:2, date:'2026-02-14T23:00', comp:'Campeonato Mineiro',    stadium:'Zama Maciel'},
    {id:'j12', home:'Pouso Alegre', away:'Cruzeiro',  homeScore:1, awayScore:2, date:'2026-02-21T22:30', comp:'Campeonato Mineiro',    stadium:'Manduzão'},
    {id:'j13', home:'Cruzeiro',  away:'Corinthians',  homeScore:1, awayScore:1, date:'2026-02-26T00:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j14', home:'Cruzeiro',  away:'Pouso Alegre', homeScore:1, awayScore:0, date:'2026-02-28T22:30', comp:'Campeonato Mineiro',    stadium:'Mineirão'},
    // MARÇO
    {id:'j15', home:'Cruzeiro',  away:'Atlético-MG',  homeScore:1, awayScore:0, date:'2026-03-08T22:00', comp:'Campeonato Mineiro',    stadium:'Mineirão'},
    {id:'j16', home:'Flamengo',  away:'Cruzeiro',     homeScore:2, awayScore:0, date:'2026-03-12T01:30', comp:'Campeonato Brasileiro', stadium:'Maracanã'},
    {id:'j17', home:'Cruzeiro',  away:'Vasco',        homeScore:3, awayScore:3, date:'2026-03-16T00:30', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j18', home:'Athletico-PR', away:'Cruzeiro',  homeScore:2, awayScore:1, date:'2026-03-18T23:30', comp:'Campeonato Brasileiro', stadium:'Ligga Arena'},
    {id:'j19', home:'Cruzeiro',  away:'Santos',       homeScore:0, awayScore:0, date:'2026-03-22T20:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    // ABRIL
    {id:'j20', home:'Cruzeiro',  away:'Vitória',      homeScore:3, awayScore:0, date:'2026-04-02T01:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j21', home:'São Paulo', away:'Cruzeiro',     homeScore:4, awayScore:1, date:'2026-04-04T23:30', comp:'Campeonato Brasileiro', stadium:'Morumbi'},
    {id:'j22', home:'Barcelona Guayaquil', away:'Cruzeiro', homeScore:0, awayScore:1, date:'2026-04-08T02:00', comp:'Copa Libertadores', stadium:'Monumental Isidro Romero'},
    {id:'j23', home:'Cruzeiro',  away:'Red Bull Bragantino', homeScore:2, awayScore:1, date:'2026-04-12T23:30', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j24', home:'Cruzeiro',  away:'Univ. Católica', homeScore:1, awayScore:2, date:'2026-04-16T00:00', comp:'Copa Libertadores', stadium:'Mineirão'},
    {id:'j25', home:'Cruzeiro',  away:'Grêmio',       homeScore:2, awayScore:0, date:'2026-04-19T01:30', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j26', home:'Goiás',     away:'Cruzeiro',     homeScore:2, awayScore:2, date:'2026-04-23T00:00', comp:'Copa do Brasil',       stadium:'Serra Dourada'},
    {id:'j27', home:'Remo',      away:'Cruzeiro',     homeScore:0, awayScore:1, date:'2026-04-25T23:30', comp:'Campeonato Brasileiro', stadium:'Baenão'},
    {id:'j28', home:'Cruzeiro',  away:'Boca Juniors', homeScore:1, awayScore:0, date:'2026-04-29T02:30', comp:'Copa Libertadores', stadium:'Mineirão'},
    // MAIO
    {id:'j29', home:'Cruzeiro',  away:'Atlético-MG',  homeScore:1, awayScore:3, date:'2026-05-03T02:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j30', home:'Univ. Católica', away:'Cruzeiro', homeScore:0, awayScore:0, date:'2026-05-07T04:00', comp:'Copa Libertadores', stadium:'San Carlos de Apoquindo'},
    {id:'j31', home:'Bahia',     away:'Cruzeiro',     homeScore:1, awayScore:2, date:'2026-05-10T02:00', comp:'Campeonato Brasileiro', stadium:'Fonte Nova'},
    {id:'j32', home:'Cruzeiro',  away:'Goiás',        homeScore:1, awayScore:0, date:'2026-05-13T02:30', comp:'Copa do Brasil',       stadium:'Mineirão'},
    {id:'j33', home:'Palmeiras', away:'Cruzeiro',     homeScore:1, awayScore:1, date:'2026-05-17T02:00', comp:'Campeonato Brasileiro', stadium:'Arena Barueri'},
    {id:'j34', home:'Boca Juniors', away:'Cruzeiro',  homeScore:1, awayScore:1, date:'2026-05-20T02:30', comp:'Copa Libertadores', stadium:'La Bombonera'},
    {id:'j35', home:'Cruzeiro',  away:'Chapecoense',  homeScore:2, awayScore:1, date:'2026-05-24T21:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j36', home:'Cruzeiro',  away:'Barcelona Guayaquil', homeScore:4, awayScore:0, date:'2026-05-29T02:30', comp:'Copa Libertadores', stadium:'Mineirão'},
    // JUNHO
    {id:'j37', home:'Cruzeiro',  away:'Fluminense',   homeScore:1, awayScore:1, date:'2026-06-01T01:30', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    // JULHO
    {id:'j38', home:'Cruzeiro',  away:'Defensor Sporting', homeScore:2, awayScore:0, date:'2026-07-04T16:00', comp:'Amistoso', stadium:'Independência'},
    {id:'j39', home:'Cruzeiro',  away:'Grêmio',       homeScore:1, awayScore:3, date:'2026-07-12T22:00', comp:'Amistoso', stadium:'Mané Garrincha'},
    {id:'j40', home:'Internacional', away:'Cruzeiro', homeScore:null, awayScore:null, date:'2026-07-23T02:30', comp:'Campeonato Brasileiro', stadium:'Beira Rio'},
    {id:'j41', home:'Cruzeiro',  away:'Botafogo',     homeScore:null, awayScore:null, date:'2026-07-26T21:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j42', home:'Coritiba',  away:'Cruzeiro',     homeScore:null, awayScore:null, date:'2026-07-31T02:30', comp:'Campeonato Brasileiro', stadium:'Couto Pereira'},
    // AGOSTO
    {id:'j43', home:'Chapecoense', away:'Cruzeiro',   homeScore:null, awayScore:null, date:'2026-08-02T23:30', comp:'Copa do Brasil', stadium:'Arena Condá'},
    {id:'j44', home:'Cruzeiro',  away:'Chapecoense',  homeScore:null, awayScore:null, date:'2026-08-06T00:00', comp:'Copa do Brasil', stadium:'Mineirão'},
    {id:'j45', home:'Cruzeiro',  away:'Mirassol',     homeScore:null, awayScore:null, date:'2026-08-09T16:00', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j46', home:'Cruzeiro',  away:'Flamengo',     homeScore:null, awayScore:null, date:'2026-08-13T02:30', comp:'Copa Libertadores', stadium:'Mineirão'},
    {id:'j47', home:'Corinthians', away:'Cruzeiro',   homeScore:null, awayScore:null, date:'2026-08-17T00:30', comp:'Campeonato Brasileiro', stadium:'Neo Química Arena'},
    {id:'j48', home:'Flamengo',  away:'Cruzeiro',     homeScore:null, awayScore:null, date:'2026-08-20T02:30', comp:'Copa Libertadores', stadium:'Maracanã'},
    {id:'j49', home:'Cruzeiro',  away:'Flamengo',     homeScore:null, awayScore:null, date:'2026-08-23T01:30', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    // SETEMBRO
    {id:'j50', home:'Vasco',     away:'Cruzeiro',     homeScore:null, awayScore:null, date:'2026-09-01', comp:'Campeonato Brasileiro', stadium:'São Januário'},
    {id:'j51', home:'Cruzeiro',  away:'Athletico-PR', homeScore:null, awayScore:null, date:'2026-09-01', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j52', home:'Santos',    away:'Cruzeiro',     homeScore:null, awayScore:null, date:'2026-09-01', comp:'Campeonato Brasileiro', stadium:'Vila Belmiro'},
    {id:'j53', home:'Vitória',   away:'Cruzeiro',     homeScore:null, awayScore:null, date:'2026-09-01', comp:'Campeonato Brasileiro', stadium:'Barradão'},
    // OUTUBRO
    {id:'j54', home:'Cruzeiro',  away:'São Paulo',    homeScore:null, awayScore:null, date:'2026-10-07', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j55', home:'RB Bragantino', away:'Cruzeiro', homeScore:null, awayScore:null, date:'2026-10-10', comp:'Campeonato Brasileiro', stadium:'Nabi Abi Chedid'},
    {id:'j56', home:'Grêmio',    away:'Cruzeiro',     homeScore:null, awayScore:null, date:'2026-10-17', comp:'Campeonato Brasileiro', stadium:'Arena do Grêmio'},
    {id:'j57', home:'Cruzeiro',  away:'Remo',         homeScore:null, awayScore:null, date:'2026-10-24', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j58', home:'Atlético-MG', away:'Cruzeiro',   homeScore:null, awayScore:null, date:'2026-10-28', comp:'Campeonato Brasileiro', stadium:'Arena MRV'},
    // NOVEMBRO
    {id:'j59', home:'Cruzeiro',  away:'Bahia',        homeScore:null, awayScore:null, date:'2026-11-04', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j60', home:'Cruzeiro',  away:'Palmeiras',    homeScore:null, awayScore:null, date:'2026-11-18', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
    {id:'j61', home:'Chapecoense', away:'Cruzeiro',   homeScore:null, awayScore:null, date:'2026-11-21', comp:'Campeonato Brasileiro', stadium:'Arena Condá'},
    {id:'j62', home:'Fluminense', away:'Cruzeiro',    homeScore:null, awayScore:null, date:'2026-11-28', comp:'Campeonato Brasileiro', stadium:'Maracanã'},
    // DEZEMBRO
    {id:'j63', home:'Cruzeiro',  away:'Internacional', homeScore:null, awayScore:null, date:'2026-12-02', comp:'Campeonato Brasileiro', stadium:'Mineirão'},
  ];

  return jogos.map(j => ({
    ...j,
    timestamp: ts(j.date),
    status:    status(ts(j.date), j.homeScore, j.awayScore),
    liberado:  false,
  }));
}
