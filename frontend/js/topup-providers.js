import { api } from './api.js';
import { updateOrder, ORDER_STATUS } from './orders.js';

export const TOPUP_SIM_DURATION_MS = 4000;

export class TopupProvider {
  constructor(gameId, label) {
    this.gameId = gameId;
    this.label = label;
  }

  async validatePlayer() {
    throw new Error(`Provider ${this.constructor.name} belum mengimplementasikan validatePlayer().`);
  }

  async startTopup() {
    throw new Error(`Provider ${this.constructor.name} belum mengimplementasikan startTopup().`);
  }
}

export class MobileLegendsProvider extends TopupProvider {
  constructor() {
    super('mobile_legends', 'Mobile Legends');
  }

  async validatePlayer(playerId, zoneId = null) {
    const result = await api.post('/games/mobile_legends/validate', {
      player_id: playerId,
      zone_id: zoneId,
      game_id: 'mobile_legends',
    });
    return { valid: result.valid, nickname: result.nickname };
  }

  async startTopup(order) {
    return startTopupProcessing(order);
  }
}

export class FreeFireProvider extends TopupProvider {
  constructor() {
    super('free_fire', 'Free Fire');
  }

  async validatePlayer(playerId) {
    const result = await api.post('/games/free_fire/validate', {
      player_id: playerId,
      game_id: 'free_fire',
    });
    return { valid: result.valid, nickname: result.nickname };
  }

  async startTopup(order) {
    return startTopupProcessing(order);
  }
}

const PROVIDER_REGISTRY = {
  mobile_legends: MobileLegendsProvider,
  free_fire: FreeFireProvider,
};

export function getTopupProvider(gameId) {
  const ProviderClass = PROVIDER_REGISTRY[gameId];
  if (!ProviderClass) {
    return new TopupProvider(gameId || 'unknown', 'Unknown Game');
  }
  return new ProviderClass();
}

export async function startTopupProcessing(order) {
  return updateOrder(order.order_number, {
    topup_status: ORDER_STATUS.PROCESSING,
    topup_ref: `TOP-${Date.now().toString(36).toUpperCase()}`,
    topup_started_at: new Date().toISOString(),
  });
}

export function checkTopupStatus(order) {
  if (order.topup_status === ORDER_STATUS.SUCCESS) {
    return { status: ORDER_STATUS.SUCCESS };
  }

  if (!order.topup_started_at) {
    return { status: order.topup_status };
  }

  const elapsedMs = Date.now() - new Date(order.topup_started_at).getTime();

  if (elapsedMs >= TOPUP_SIM_DURATION_MS) {
    return { status: ORDER_STATUS.SUCCESS, order };
  }

  return { status: ORDER_STATUS.PROCESSING, elapsedMs };
}
