// =============================================
// JEANSCORE – CONFIGURAÇÕES GLOBAIS
// =============================================

const CONFIG = {
  // Cruzeiro
  CRUZEIRO_NAME: 'Cruzeiro',

  // Competições monitoradas
  COMPETITIONS: {
    71:  { name: 'Série A',            short: 'Série A',  flag: '🇧🇷' },
    73:  { name: 'Copa do Brasil',     short: 'Copa BR',  flag: '🇧🇷' },
    13:  { name: 'Copa Libertadores',  short: 'Libertad', flag: '🌎'  },
    629: { name: 'Campeonato Mineiro', short: 'Mineiro',  flag: '🇧🇷' },
    999: { name: 'Amistoso',           short: 'Amistoso', flag: '🤝'  },
  },

  // Admin
  ADMIN_USER:  'Jean',
  ADMIN_EMAIL: 'jean.honorato.bh@gmail.com',

  // Google Apps Script URL
  SHEETS_API_URL: 'https://script.google.com/macros/s/AKfycbwYMgPBmEvq5Zo9oX6gDmx8p1OjsYj-zsehNpGpsaLRw-eNhBMI6C_OsFNYwcZYh64A/exec',

  // Nota padrão para jogadores que participaram mas não foram avaliados
  DEFAULT_NOTE: 5,

  // Cache em memória (ms)
  CACHE_TTL: 5 * 60 * 1000,
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
