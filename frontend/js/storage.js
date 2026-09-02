const STORAGE_KEYS = {
  SELECTED_GAME: 'topup_selected_game',
  RECENT_GAMES: 'topup_recent_games',
  RECENT_PRODUCTS: 'topup_recent_products',
  PLAYER_ID_CACHE: 'topup_player_id_cache',
  USER_PREFERENCES: 'topup_user_preferences',
  CART: 'topup_cart',
  THEME: 'topup_theme',
};

const MAX_RECENT = 5;

export function readJson(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function get(key, defaultValue = null) {
  return readJson(key, defaultValue);
}

function set(key, value) {
  return writeJson(key, value);
}

function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function clear() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  getSelectedGame() {
    return get(STORAGE_KEYS.SELECTED_GAME);
  },
  setSelectedGame(game) {
    return set(STORAGE_KEYS.SELECTED_GAME, game);
  },
  clearSelectedGame() {
    return remove(STORAGE_KEYS.SELECTED_GAME);
  },

  getRecentGames() {
    return get(STORAGE_KEYS.RECENT_GAMES, []);
  },
  addRecentGame(game) {
    const recent = this.getRecentGames();
    const filtered = recent.filter(g => g.id !== game.id);
    filtered.unshift(game);
    return set(STORAGE_KEYS.RECENT_GAMES, filtered.slice(0, MAX_RECENT));
  },

  getRecentProducts() {
    return get(STORAGE_KEYS.RECENT_PRODUCTS, []);
  },
  addRecentProduct(product) {
    const recent = this.getRecentProducts();
    const filtered = recent.filter(p => p.id !== product.id);
    filtered.unshift(product);
    return set(STORAGE_KEYS.RECENT_PRODUCTS, filtered.slice(0, MAX_RECENT));
  },

  getPlayerIdCache(gameId) {
    const cache = get(STORAGE_KEYS.PLAYER_ID_CACHE, {});
    return cache[gameId] || null;
  },
  setPlayerIdCache(gameId, playerId, zoneId = null) {
    const cache = get(STORAGE_KEYS.PLAYER_ID_CACHE, {});
    cache[gameId] = { playerId, zoneId, timestamp: Date.now() };
    return set(STORAGE_KEYS.PLAYER_ID_CACHE, cache);
  },

  getPreferences() {
    return get(STORAGE_KEYS.USER_PREFERENCES, {
      reducedMotion: false,
      notifications: true,
      language: 'id',
    });
  },
  setPreferences(prefs) {
    const current = this.getPreferences();
    return set(STORAGE_KEYS.USER_PREFERENCES, { ...current, ...prefs });
  },

  getCart() {
    return get(STORAGE_KEYS.CART, null);
  },
  setCart(cart) {
    return set(STORAGE_KEYS.CART, cart);
  },
  clearCart() {
    return remove(STORAGE_KEYS.CART);
  },

  getTheme() {
    return get(STORAGE_KEYS.THEME, 'dark');
  },
  setTheme(theme) {
    return set(STORAGE_KEYS.THEME, theme);
  },
};

export const sessionStorageUtil = {
  get(key, defaultValue = null) {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

export function initTheme() {
  const savedTheme = storage.getTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  storage.setTheme(newTheme);
  return newTheme;
}