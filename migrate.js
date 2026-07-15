// Migration script — run with: node migrate.js
// Populates Supabase with squad and fixtures data

const SUPA_URL = 'https://ozsissvmrniwmgxsgzdh.supabase.co';
const SUPA_KEY = 'sb_publishable_gke_OLA7RhoTCuunJrJzoA_a9vX4GUp';

const headers = {
  'apikey':        SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'resolution=merge-duplicates',
};

async function upsert(table, data) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  const text = await res.text();
  console.log(`${table}: HTTP ${res.status} — ${res.ok ? 'OK' : text.substring(0,100)}`);
  return res.ok;
}

const squad = [
  {id:'crz_1',  name:'Cássio',           position:'Goalkeeper', number:'1',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Cassio-01.png',           nationality:'Brazil',    manual:false},
  {id:'crz_81', name:'Otávio',            position:'Goalkeeper', number:'81', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Otavio-01.png',           nationality:'Brazil',    manual:false},
  {id:'crz_41', name:'Léo Aragão',        position:'Goalkeeper', number:'41', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Leo-Aragao-01.png',       nationality:'Brazil',    manual:false},
  {id:'crz_31', name:'Matheus Cunha',     position:'Goalkeeper', number:'31', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Matheus-Cunha-01.png',    nationality:'Brazil',    manual:false},
  {id:'crz_24', name:'Marcelo Eráclito',  position:'Goalkeeper', number:'24', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Marcelo-01.png',          nationality:'Brazil',    manual:false},
  {id:'crz_51', name:'Vitor Lamounier',   position:'Goalkeeper', number:'51', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Vitor-Lamounier-01.png',  nationality:'Brazil',    manual:false},
  {id:'crz_15', name:'Fabrício Bruno',    position:'Defender',   number:'15', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Fabricio-Bruno-01.png',   nationality:'Brazil',    manual:false},
  {id:'crz_25', name:'Lucas Villalba',    position:'Defender',   number:'25', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Lucas-Villalba-01.png',   nationality:'Uruguay',   manual:false},
  {id:'crz_34', name:'Jonathan Jesus',    position:'Defender',   number:'34', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Jonathan-Jesus-01.png',   nationality:'Brazil',    manual:false},
  {id:'crz_43', name:'João Marcelo',      position:'Defender',   number:'43', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Joao-Marcelo-01.png',     nationality:'Brazil',    manual:false},
  {id:'crz_12', name:'William',           position:'Defender',   number:'12', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/William-01.png',          nationality:'Brazil',    manual:false},
  {id:'crz_23', name:'Fágner',            position:'Defender',   number:'23', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Fagner-01.png',           nationality:'Brazil',    manual:false},
  {id:'crz_2',  name:'Kauã Moraes',       position:'Defender',   number:'2',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Kaua-Moraes-01.png',      nationality:'Brazil',    manual:false},
  {id:'crz_27', name:'Rojas',             position:'Defender',   number:'27', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Gabriel-Rojas-02.png',    nationality:'Colombia',  manual:false},
  {id:'crz_29', name:'Lucas Romero',      position:'Midfielder', number:'29', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Lucas-Romero-01.png',     nationality:'Argentina', manual:false},
  {id:'crz_16', name:'Lucas Silva',       position:'Midfielder', number:'16', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Lucas-Silva-01.png',      nationality:'Brazil',    manual:false},
  {id:'crz_8',  name:'Matheus Henrique',  position:'Midfielder', number:'8',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Matheus-Henrique-01.png', nationality:'Brazil',    manual:false},
  {id:'crz_11', name:'Gerson',            position:'Midfielder', number:'11', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Gerson-01.png',           nationality:'Brazil',    manual:false},
  {id:'crz_35', name:'Murilo Rhikman',    position:'Midfielder', number:'35', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Murilo-Rhikman-01.png',   nationality:'Brazil',    manual:false},
  {id:'crz_40', name:'Rhuan Gabriel',     position:'Midfielder', number:'40', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Rhuan-Gabriel-01.png',    nationality:'Brazil',    manual:false},
  {id:'crz_10', name:'Matheus Pereira',   position:'Attacker',   number:'10', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Matheus-Pereira-01.png',  nationality:'Brazil',    manual:false},
  {id:'crz_19', name:'Kaio Jorge',        position:'Attacker',   number:'19', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Kaio-Jorge-01.png',       nationality:'Brazil',    manual:false},
  {id:'crz_94', name:'Wanderson',         position:'Attacker',   number:'94', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Wanderson-01.png',        nationality:'Brazil',    manual:false},
  {id:'crz_99', name:'Arroyo',            position:'Attacker',   number:'99', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Keny-Arroyo-01.png',      nationality:'Ecuador',   manual:false},
  {id:'crz_17', name:'Sinisterra',        position:'Attacker',   number:'17', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Sinisterra-01.png',       nationality:'Colombia',  manual:false},
  {id:'crz_77', name:'Gabriel Pec',       position:'Attacker',   number:'77', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Gabriel-Pec-01.png',      nationality:'Brazil',    manual:false},
  {id:'crz_9',  name:'Bruno Rodrigues',   position:'Attacker',   number:'9',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Bruno-Rodrigues-01.png',  nationality:'Brazil',    manual:false},
  {id:'crz_7',  name:'Marquinhos',        position:'Attacker',   number:'7',  photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Marquinhos-01.png',       nationality:'Brazil',    manual:false},
  {id:'crz_70', name:'Kaique Kenji',      position:'Attacker',   number:'70', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Kaique-Kenji-01.png',     nationality:'Brazil',    manual:false},
  {id:'crz_22', name:'Néiser Villarreal', position:'Attacker',   number:'22', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Neiser-Villalrreal-01.png',nationality:'Venezuela',manual:false},
  {id:'crz_91', name:'Chico da Costa',    position:'Attacker',   number:'91', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Chico-da-Costa-01.png',   nationality:'Brazil',    manual:false},
  {id:'crz_57', name:'Rayan Lelis',       position:'Attacker',   number:'57', photo:'https://imagens.cruzeiro.com.br/Elenco/2026/Masculino/Thumb/Rayan-Lelis-01.png',      nationality:'Brazil',    manual:false},
];

function ts(d) { try { return Math.floor(new Date(d).getTime()/1000); } catch(e) { return 0; } }
function status(t, hs) { return hs !== null ? 'finished' : (t > 0 && t < Date.now()/1000 ? 'finished' : 'notstarted'); }

const fixtures = [
  {id:'j01',home:'Cruzeiro',away:'Pouso Alegre',home_score:1,away_score:2,fixture_date:'2026-01-10T22:30',competition:'Campeonato Mineiro',stadium:'Mineirão'},
  {id:'j02',home:'Tombense',away:'Cruzeiro',home_score:1,away_score:2,fixture_date:'2026-01-15T01:30',competition:'Campeonato Mineiro',stadium:'Parque do Sabiá'},
  {id:'j03',home:'Cruzeiro',away:'Uberlândia',home_score:5,away_score:0,fixture_date:'2026-01-17T22:30',competition:'Campeonato Mineiro',stadium:'Mineirão'},
  {id:'j04',home:'Cruzeiro',away:'Democrata-GV',home_score:0,away_score:1,fixture_date:'2026-01-22T22:30',competition:'Campeonato Mineiro',stadium:'Mineirão'},
  {id:'j05',home:'Atlético-MG',away:'Cruzeiro',home_score:2,away_score:1,fixture_date:'2026-01-25T22:00',competition:'Campeonato Mineiro',stadium:'Arena MRV'},
  {id:'j06',home:'Botafogo',away:'Cruzeiro',home_score:4,away_score:0,fixture_date:'2026-01-30T01:30',competition:'Campeonato Brasileiro',stadium:'Nilton Santos'},
  {id:'j07',home:'Betim',away:'Cruzeiro',home_score:0,away_score:1,fixture_date:'2026-02-02T00:00',competition:'Campeonato Mineiro',stadium:'Arena URBSAN'},
  {id:'j08',home:'Cruzeiro',away:'Coritiba',home_score:1,away_score:2,fixture_date:'2026-02-06T01:30',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j09',home:'Cruzeiro',away:'América-MG',home_score:2,away_score:0,fixture_date:'2026-02-08T22:00',competition:'Campeonato Mineiro',stadium:'Mineirão'},
  {id:'j10',home:'Mirassol',away:'Cruzeiro',home_score:2,away_score:2,fixture_date:'2026-02-11T23:00',competition:'Campeonato Brasileiro',stadium:'Maião'},
  {id:'j11',home:'URT',away:'Cruzeiro',home_score:1,away_score:2,fixture_date:'2026-02-14T23:00',competition:'Campeonato Mineiro',stadium:'Zama Maciel'},
  {id:'j12',home:'Pouso Alegre',away:'Cruzeiro',home_score:1,away_score:2,fixture_date:'2026-02-21T22:30',competition:'Campeonato Mineiro',stadium:'Manduzão'},
  {id:'j13',home:'Cruzeiro',away:'Corinthians',home_score:1,away_score:1,fixture_date:'2026-02-26T00:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j14',home:'Cruzeiro',away:'Pouso Alegre',home_score:1,away_score:0,fixture_date:'2026-02-28T22:30',competition:'Campeonato Mineiro',stadium:'Mineirão'},
  {id:'j15',home:'Cruzeiro',away:'Atlético-MG',home_score:1,away_score:0,fixture_date:'2026-03-08T22:00',competition:'Campeonato Mineiro',stadium:'Mineirão'},
  {id:'j16',home:'Flamengo',away:'Cruzeiro',home_score:2,away_score:0,fixture_date:'2026-03-12T01:30',competition:'Campeonato Brasileiro',stadium:'Maracanã'},
  {id:'j17',home:'Cruzeiro',away:'Vasco',home_score:3,away_score:3,fixture_date:'2026-03-16T00:30',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j18',home:'Athletico-PR',away:'Cruzeiro',home_score:2,away_score:1,fixture_date:'2026-03-18T23:30',competition:'Campeonato Brasileiro',stadium:'Ligga Arena'},
  {id:'j19',home:'Cruzeiro',away:'Santos',home_score:0,away_score:0,fixture_date:'2026-03-22T20:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j20',home:'Cruzeiro',away:'Vitória',home_score:3,away_score:0,fixture_date:'2026-04-02T01:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j21',home:'São Paulo',away:'Cruzeiro',home_score:4,away_score:1,fixture_date:'2026-04-04T23:30',competition:'Campeonato Brasileiro',stadium:'Morumbi'},
  {id:'j22',home:'Barcelona Guayaquil',away:'Cruzeiro',home_score:0,away_score:1,fixture_date:'2026-04-08T02:00',competition:'Copa Libertadores',stadium:'Monumental'},
  {id:'j23',home:'Cruzeiro',away:'Red Bull Bragantino',home_score:2,away_score:1,fixture_date:'2026-04-12T23:30',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j24',home:'Cruzeiro',away:'Univ. Católica',home_score:1,away_score:2,fixture_date:'2026-04-16T00:00',competition:'Copa Libertadores',stadium:'Mineirão'},
  {id:'j25',home:'Cruzeiro',away:'Grêmio',home_score:2,away_score:0,fixture_date:'2026-04-19T01:30',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j26',home:'Goiás',away:'Cruzeiro',home_score:2,away_score:2,fixture_date:'2026-04-23T00:00',competition:'Copa do Brasil',stadium:'Serra Dourada'},
  {id:'j27',home:'Remo',away:'Cruzeiro',home_score:0,away_score:1,fixture_date:'2026-04-25T23:30',competition:'Campeonato Brasileiro',stadium:'Baenão'},
  {id:'j28',home:'Cruzeiro',away:'Boca Juniors',home_score:1,away_score:0,fixture_date:'2026-04-29T02:30',competition:'Copa Libertadores',stadium:'Mineirão'},
  {id:'j29',home:'Cruzeiro',away:'Atlético-MG',home_score:1,away_score:3,fixture_date:'2026-05-03T02:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j30',home:'Univ. Católica',away:'Cruzeiro',home_score:0,away_score:0,fixture_date:'2026-05-07T04:00',competition:'Copa Libertadores',stadium:'San Carlos'},
  {id:'j31',home:'Bahia',away:'Cruzeiro',home_score:1,away_score:2,fixture_date:'2026-05-10T02:00',competition:'Campeonato Brasileiro',stadium:'Fonte Nova'},
  {id:'j32',home:'Cruzeiro',away:'Goiás',home_score:1,away_score:0,fixture_date:'2026-05-13T02:30',competition:'Copa do Brasil',stadium:'Mineirão'},
  {id:'j33',home:'Palmeiras',away:'Cruzeiro',home_score:1,away_score:1,fixture_date:'2026-05-17T02:00',competition:'Campeonato Brasileiro',stadium:'Arena Barueri'},
  {id:'j34',home:'Boca Juniors',away:'Cruzeiro',home_score:1,away_score:1,fixture_date:'2026-05-20T02:30',competition:'Copa Libertadores',stadium:'La Bombonera'},
  {id:'j35',home:'Cruzeiro',away:'Chapecoense',home_score:2,away_score:1,fixture_date:'2026-05-24T21:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j36',home:'Cruzeiro',away:'Barcelona Guayaquil',home_score:4,away_score:0,fixture_date:'2026-05-29T02:30',competition:'Copa Libertadores',stadium:'Mineirão'},
  {id:'j37',home:'Cruzeiro',away:'Fluminense',home_score:1,away_score:1,fixture_date:'2026-06-01T01:30',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j38',home:'Cruzeiro',away:'Defensor Sporting',home_score:2,away_score:0,fixture_date:'2026-07-04T16:00',competition:'Amistoso',stadium:'Independência'},
  {id:'j39',home:'Cruzeiro',away:'Grêmio',home_score:1,away_score:3,fixture_date:'2026-07-12T22:00',competition:'Amistoso',stadium:'Mané Garrincha'},
  {id:'j40',home:'Internacional',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-07-23T02:30',competition:'Campeonato Brasileiro',stadium:'Beira Rio'},
  {id:'j41',home:'Cruzeiro',away:'Botafogo',home_score:null,away_score:null,fixture_date:'2026-07-26T21:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j42',home:'Coritiba',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-07-31T02:30',competition:'Campeonato Brasileiro',stadium:'Couto Pereira'},
  {id:'j43',home:'Chapecoense',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-08-02T23:30',competition:'Copa do Brasil',stadium:'Arena Condá'},
  {id:'j44',home:'Cruzeiro',away:'Chapecoense',home_score:null,away_score:null,fixture_date:'2026-08-06T00:00',competition:'Copa do Brasil',stadium:'Mineirão'},
  {id:'j45',home:'Cruzeiro',away:'Mirassol',home_score:null,away_score:null,fixture_date:'2026-08-09T16:00',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j46',home:'Cruzeiro',away:'Flamengo',home_score:null,away_score:null,fixture_date:'2026-08-13T02:30',competition:'Copa Libertadores',stadium:'Mineirão'},
  {id:'j47',home:'Corinthians',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-08-17T00:30',competition:'Campeonato Brasileiro',stadium:'Neo Química Arena'},
  {id:'j48',home:'Flamengo',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-08-20T02:30',competition:'Copa Libertadores',stadium:'Maracanã'},
  {id:'j49',home:'Cruzeiro',away:'Flamengo',home_score:null,away_score:null,fixture_date:'2026-08-23T01:30',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j50',home:'Vasco',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-09-01',competition:'Campeonato Brasileiro',stadium:'São Januário'},
  {id:'j51',home:'Cruzeiro',away:'Athletico-PR',home_score:null,away_score:null,fixture_date:'2026-09-01',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j52',home:'Santos',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-09-01',competition:'Campeonato Brasileiro',stadium:'Vila Belmiro'},
  {id:'j53',home:'Vitória',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-09-01',competition:'Campeonato Brasileiro',stadium:'Barradão'},
  {id:'j54',home:'Cruzeiro',away:'São Paulo',home_score:null,away_score:null,fixture_date:'2026-10-07',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j55',home:'RB Bragantino',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-10-10',competition:'Campeonato Brasileiro',stadium:'Nabi Abi Chedid'},
  {id:'j56',home:'Grêmio',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-10-17',competition:'Campeonato Brasileiro',stadium:'Arena do Grêmio'},
  {id:'j57',home:'Cruzeiro',away:'Remo',home_score:null,away_score:null,fixture_date:'2026-10-24',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j58',home:'Atlético-MG',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-10-28',competition:'Campeonato Brasileiro',stadium:'Arena MRV'},
  {id:'j59',home:'Cruzeiro',away:'Bahia',home_score:null,away_score:null,fixture_date:'2026-11-04',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j60',home:'Cruzeiro',away:'Palmeiras',home_score:null,away_score:null,fixture_date:'2026-11-18',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
  {id:'j61',home:'Chapecoense',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-11-21',competition:'Campeonato Brasileiro',stadium:'Arena Condá'},
  {id:'j62',home:'Fluminense',away:'Cruzeiro',home_score:null,away_score:null,fixture_date:'2026-11-28',competition:'Campeonato Brasileiro',stadium:'Maracanã'},
  {id:'j63',home:'Cruzeiro',away:'Internacional',home_score:null,away_score:null,fixture_date:'2026-12-02',competition:'Campeonato Brasileiro',stadium:'Mineirão'},
].map(f => ({
  id:           f.id,
  home_team:    f.home,
  away_team:    f.away,
  home_score:   f.home_score,
  away_score:   f.away_score,
  fixture_date: f.fixture_date,
  ts:           ts(f.fixture_date),
  competition:  f.competition,
  stadium:      f.stadium,
  status:       status(ts(f.fixture_date), f.home_score),
  liberado:     false,
  manual:       false,
}));

async function main() {
  console.log('Migrating squad...');
  await upsert('squad', squad);

  console.log('Migrating fixtures...');
  // Send in batches of 20 to avoid payload limits
  for (let i = 0; i < fixtures.length; i += 20) {
    const batch = fixtures.slice(i, i + 20);
    await upsert('fixtures', batch);
  }

  console.log('Done!');
}

main().catch(console.error);
