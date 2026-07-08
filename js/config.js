// =============================================
// JEANSCORE – CONFIGURAÇÕES GLOBAIS
// =============================================

const CONFIG = {
  // API-Football
  API_KEY: '477d6449d7eb1e2a6722e67624eb4b99',
  API_BASE: 'https://v3.football.api-sports.io',

  // Cruzeiro
  CRUZEIRO_ID: 135,       // ID do Cruzeiro na API-Football
  CRUZEIRO_NAME: 'Cruzeiro',

  // Temporada (2024 = última temporada com dados disponíveis no plano Free)
  SEASON: 2024,

  // Competições monitoradas
  COMPETITIONS: {
    71:  { name: 'Série A',           short: 'Série A',  flag: '🇧🇷' },
    73:  { name: 'Copa do Brasil',    short: 'Copa BR',  flag: '🇧🇷' },
    13:  { name: 'Libertadores',      short: 'Libertad', flag: '🌎' },
    629: { name: 'Campeonato Mineiro',short: 'Mineiro',  flag: '🇧🇷' },
  },

  // Admin
  ADMIN_USER: 'Jean',
  ADMIN_EMAIL: 'jean.honorato.bh@gmail.com',

  // Google Apps Script URL
  SHEETS_API_URL: 'https://script.google.com/macros/s/AKfycbytRVym5fPvrKp5RDDyMONEWmkiBSQ3I47YgR1Zuz_SAGFURXL_ReSU3mY_oNb1_OKF/exec',

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
