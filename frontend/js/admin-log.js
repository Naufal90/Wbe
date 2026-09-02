import { readJson, writeJson } from './storage.js';

const ADMIN_LOGS_KEY = 'topup_admin_logs';
const MAX_LOGS = 100;

export function addAdminLog(action, target, detail = '') {
  const logs = getAdminLogs();
  logs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor: 'admin-lokal',
    action,
    target,
    detail,
  });
  return writeJson(ADMIN_LOGS_KEY, logs.slice(0, MAX_LOGS));
}

export function getAdminLogs() {
  const logs = readJson(ADMIN_LOGS_KEY, []);
  return Array.isArray(logs) ? logs : [];
}
