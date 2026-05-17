import type { GameState, NpcAction } from '../battle/types';
import { HttpNpcService } from './httpNpcService';
import { MockNpcService } from './mockNpcService';

export interface NpcService {
  decideAction(state: GameState): Promise<NpcAction>;
}

export type NpcRuntimeConfig = {
  mode: 'mock' | 'http';
  endpoint: string;
  timeoutMs: number;
  contract: 'simple' | 'legacy-batalla-accion';
};

const DEFAULT_ENDPOINT = '/decide-action';
const DEFAULT_TIMEOUT_MS = 1500;

function normalizeMode(value: string | undefined): NpcRuntimeConfig['mode'] {
  return value === 'http' ? 'http' : 'mock';
}

function normalizeTimeout(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

function normalizeEndpoint(value: string | undefined): string {
  return value && value.trim().length > 0 ? value.trim() : DEFAULT_ENDPOINT;
}

function normalizeContract(
  contractValue: string | undefined,
  endpoint: string,
): NpcRuntimeConfig['contract'] {
  if (contractValue === 'legacy-batalla-accion') {
    return 'legacy-batalla-accion';
  }

  return endpoint.includes('/batalla/accion') ? 'legacy-batalla-accion' : 'simple';
}

export function getNpcRuntimeConfig(): NpcRuntimeConfig {
  const endpoint = normalizeEndpoint(import.meta.env.VITE_NPC_ENDPOINT);

  return {
    mode: normalizeMode(import.meta.env.VITE_NPC_MODE),
    endpoint,
    timeoutMs: normalizeTimeout(import.meta.env.VITE_NPC_TIMEOUT_MS),
    contract: normalizeContract(import.meta.env.VITE_NPC_CONTRACT, endpoint),
  };
}

export function createNpcService(config: NpcRuntimeConfig = getNpcRuntimeConfig()): NpcService {
  const fallbackService = new MockNpcService();

  if (config.mode !== 'http') {
    return fallbackService;
  }

  return new HttpNpcService({
    endpoint: config.endpoint,
    timeoutMs: config.timeoutMs,
    contract: config.contract,
    fallbackService,
  });
}
