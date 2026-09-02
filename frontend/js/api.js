const API_BASE = window.APP_CONFIG?.API_BASE || '/api';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getToken() {
  try {
    const raw = localStorage.getItem('topup_auth_token');
    return raw || null;
  } catch { return null; }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem('topup_auth_token', token);
    else localStorage.removeItem('topup_auth_token');
  } catch {}
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('topup_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStoredUser(user) {
  try {
    if (user) localStorage.setItem('topup_auth_user', JSON.stringify(user));
    else localStorage.removeItem('topup_auth_user');
  } catch {}
}

export { getToken, setToken, getStoredUser, setStoredUser };

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const config = {
    headers: { ...DEFAULT_HEADERS, ...authHeaders, ...options.headers },
    credentials: 'include',
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      throw new ApiError(
        data?.detail || data?.message || `HTTP Error: ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 0);
    }
    throw new ApiError(error.message || 'Terjadi kesalahan tidak terduga', 0);
  }
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};

export async function getGames() {
  return api.get('/games');
}

export async function getGameProducts(gameId) {
  return api.get(`/games/${gameId}/products`);
}

export async function validatePlayerId(gameId, playerId, zoneId = null) {
  const body = { player_id: playerId, game_id: gameId };
  if (zoneId) body.zone_id = zoneId;
  return api.post(`/games/${gameId}/validate`, body);
}

export async function createOrder(orderData) {
  return api.post('/orders', orderData);
}

export async function getOrderStatus(orderId) {
  return api.get(`/orders/${orderId}`);
}

export async function getPaymentMethods() {
  return api.get('/payment-methods');
}

export async function createPayment(orderId, paymentMethod) {
  return api.post(`/orders/${orderId}/pay`, { payment_method: paymentMethod });
}

export async function checkPaymentStatus(paymentId) {
  return api.get(`/payments/${paymentId}/status`);
}

export async function login(credentials) {
  return api.post('/auth/login', credentials);
}

export async function register(userData) {
  return api.post('/auth/register', userData);
}

export async function logout() {
  return api.post('/auth/logout');
}

export async function getCurrentUser() {
  return api.get('/auth/me');
}

export async function getOrderHistory(params = {}) {
  const query = new URLSearchParams(params).toString();
  return api.get(`/orders${query ? '?' + query : ''}`);
}
