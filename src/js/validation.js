export const VALIDATION_RULES = {
  mobile_legends: {
    playerId: {
      pattern: /^\d{5,12}$/,
      message: 'User ID Mobile Legends harus berupa angka 5-12 digit',
    },
    zoneId: {
      pattern: /^\d{1,5}$/,
      message: 'Zone ID harus berupa angka 1-5 digit',
    },
  },
  free_fire: {
    playerId: {
      pattern: /^\d{8,12}$/,
      message: 'Player ID Free Fire harus berupa angka 8-12 digit',
    },
  },
};

export function validatePlayerId(gameId, playerId, zoneId = null) {
  const rules = VALIDATION_RULES[gameId];
  if (!rules) {
    return { valid: false, errors: { general: 'Game tidak dikenali' } };
  }

  const idLabel = gameId === 'mobile_legends' ? 'User ID' : 'Player ID';
  const errors = {};

  if (!playerId || !playerId.trim()) {
    errors.playerId = `${idLabel} wajib diisi`;
  } else if (!rules.playerId.pattern.test(playerId.trim())) {
    errors.playerId = rules.playerId.message;
  }

  if (gameId === 'mobile_legends') {
    if (!zoneId || !zoneId.trim()) {
      errors.zoneId = 'Zone ID wajib diisi';
    } else if (!rules.zoneId.pattern.test(zoneId.trim())) {
      errors.zoneId = rules.zoneId.message;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateEmail(email) {
  if (!email || !email.trim()) {
    return { valid: false, message: 'Email wajib diisi' };
  }
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email.trim())) {
    return { valid: false, message: 'Format email tidak valid' };
  }
  return { valid: true };
}

export function validatePassword(password, minLength = 8) {
  if (!password) {
    return { valid: false, message: 'Password wajib diisi' };
  }
  if (password.length < minLength) {
    return { valid: false, message: `Password minimal ${minLength} karakter` };
  }
  return { valid: true };
}

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { valid: false, message: `${fieldName} wajib diisi` };
  }
  return { valid: true };
}

export function validateNumeric(value, fieldName, min = null, max = null) {
  const required = validateRequired(value, fieldName);
  if (!required.valid) return required;

  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} harus berupa angka` };
  }
  if (min !== null && num < min) {
    return { valid: false, message: `${fieldName} minimal ${min}` };
  }
  if (max !== null && num > max) {
    return { valid: false, message: `${fieldName} maksimal ${max}` };
  }
  return { valid: true };
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>\"'&]/g, '');
}

export function formatPlayerId(gameId, playerId) {
  const sanitized = sanitizeInput(playerId);
  if (gameId === 'mobile_legends') {
    return sanitized.replace(/\D/g, '').slice(0, 12);
  }
  if (gameId === 'free_fire') {
    return sanitized.replace(/\D/g, '').slice(0, 12);
  }
  return sanitized;
}

export function formatZoneId(zoneId) {
  const sanitized = sanitizeInput(zoneId);
  return sanitized.replace(/\D/g, '').slice(0, 5);
}

export function getValidationMessage(gameId, field) {
  const rules = VALIDATION_RULES[gameId];
  if (!rules || !rules[field]) return '';
  return rules[field].message;
}