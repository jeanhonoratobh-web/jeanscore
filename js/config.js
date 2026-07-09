// =============================================
// JEANSCORE – CONFIGURAÇÕES GLOBAIS
// =============================================

const CONFIG = {
  // API-Football
  API_KEY: '477d6449d7eb1e2a6722e67624eb4b99',
  API_BASE: 'https://v3.football.api-sports.io',

  // Cruzeiro
  CRUZEIRO_ID: 135,       // ID do Cruzeiro na API-Football (elenco)
  CRUZEIRO_SOFA_ID: 1954, // ID do Cruzeiro no SofaScore (jogos/escalações)
  CRUZEIRO_NAME: 'Cruzeiro',

  // Temporada (2024 = última temporada com dados disponíveis no plano Free)
  SEASON: 2024,

  // Competições monitoradas (IDs SofaScore)
  COMPETITIONS: {
    71:  { name: 'Série A',           short: 'Série A',  flag: '🇧🇷', sofaId: 325  },
    73:  { name: 'Copa do Brasil',    short: 'Copa BR',  flag: '🇧🇷', sofaId: 390  },
    13:  { name: 'Libertadores',      short: 'Libertad', flag: '🌎',  sofaId: 384  },
    629: { name: 'Campeonato Mineiro',short: 'Mineiro',  flag: '🇧🇷', sofaId: 893  },
    999: { name: 'Amistoso',          short: 'Amistoso', flag: '🤝',  sofaId: null },
  },

  // Mapeamento nome SofaScore → ID competição local
  SOFA_TOURNAMENT_MAP: {
    'Brasileirão Betano':       71,
    'Brasileirao Betano':       71,
    'Serie A':                  71,
    'Copa do Brasil':           73,
    'CONMEBOL Libertadores':    13,
    'Libertadores':             13,
    'Campeonato Mineiro':       629,
    'Mineiro':                  629,
  },

  // Admin
  ADMIN_USER: 'Jean',
  ADMIN_EMAIL: 'jean.honorato.bh@gmail.com',

  // Google Apps Script URL
  SHEETS_API_URL: 'https://script.google.com/macros/s/AKfycbxn4qKFWSseS5ftkhBXsHv-i_eG8-QT08eWwbOm2S04KupupIGzU4WOOOW9sEbuy8EE/exec',

  // Nota padrão para jogadores que participaram mas não foram avaliados
  DEFAULT_NOTE: 5,

  // Cache em memória (ms)
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos
};

// Cache simples em memória
const CACHE = {};

function cacheGet(key) {
  const entry = CACHE[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CONFIG.CACHE_TTL) { delete CACHE[key]; return null; }
  return entry.data;
}

function cacheSet(key, data) {
  CACHE[key] = { data, ts: Date.now() };
}
