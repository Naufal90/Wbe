import { setToken, setStoredUser, getStoredUser, getToken, api } from './api.js';

const SESSION_KEY = 'topup_auth_session';

function notifyAuthChange() {
  window.dispatchEvent(new CustomEvent('authchange'));
}

function getSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw)?.user ?? null : null;
  } catch { return null; }
}

function setSessionUser(user) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify({ user, logged_in_at: new Date().toISOString() }));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function getCurrentUser() {
  return getStoredUser() || getSessionUser();
}

export async function register({ name, email, password }) {
  try {
    const data = await api.post('/auth/register', { name, email, password });
    setToken(data.access_token);
    setStoredUser(data.user);
    setSessionUser(data.user);
    notifyAuthChange();
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message || 'Gagal mendaftar.' };
  }
}

export async function login({ email, password }) {
  try {
    const data = await api.post('/auth/login', { username_or_email: email, password });
    setToken(data.access_token);
    setStoredUser(data.user);
    setSessionUser(data.user);
    notifyAuthChange();
    return { ok: true, user: data.user };
  } catch (err) {
    const msg = err.message || 'Gagal masuk.';
    return { ok: false, error: msg };
  }
}

export function updateProfileName(newName) {
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'Belum masuk.' };

  const trimmed = newName.trim();
  if (trimmed.length < 3) return { ok: false, error: 'Nama minimal 3 karakter.' };

  api.put('/auth/me', { name: trimmed }).then(data => {
    setStoredUser(data);
    setSessionUser(data);
    notifyAuthChange();
  }).catch(() => {});

  const updatedUser = { ...user, name: trimmed };
  setStoredUser(updatedUser);
  setSessionUser(updatedUser);
  notifyAuthChange();
  return { ok: true, user: updatedUser };
}

export function updateProfileAvatar(avatarDataUrl) {
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'Belum masuk.' };

  if (avatarDataUrl && avatarDataUrl.length > 200000) {
    return { ok: false, error: 'Ukuran foto terlalu besar untuk disimpan di perangkat ini.' };
  }

  api.put('/auth/me', { avatar: avatarDataUrl || '' }).then(data => {
    setStoredUser(data);
    setSessionUser(data);
    notifyAuthChange();
  }).catch(() => {});

  const updatedUser = { ...user, avatar: avatarDataUrl || null };
  setStoredUser(updatedUser);
  setSessionUser(updatedUser);
  notifyAuthChange();
  return { ok: true, user: updatedUser };
}

export async function changePassword(currentPassword, newPassword) {
  try {
    await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Gagal mengganti kata sandi.' };
  }
}

export function logout() {
  setToken(null);
  setStoredUser(null);
  setSessionUser(null);
  notifyAuthChange();
}

export async function hashPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Perangkat ini tidak mendukung penyimpanan kata sandi yang aman.');
  }
  const data = new TextEncoder().encode(`scarlet-topup:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;

export function getLoginLockInfo() {
  return { locked: false, remainingMs: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
}
