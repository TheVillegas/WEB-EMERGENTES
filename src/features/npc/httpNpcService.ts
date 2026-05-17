import type { Battler, GameState, NpcAction, NpcActionType } from '../battle/types';
import type { NpcRuntimeConfig, NpcService } from './npcService';

type FetchLike = typeof fetch;

type HttpNpcServiceOptions = {
  endpoint: string;
  timeoutMs: number;
  contract: NpcRuntimeConfig['contract'];
  fallbackService: NpcService;
  fetchImpl?: FetchLike;
};

type SimpleNpcRequest = {
  matchId: number;
  phase: GameState['phase'];
  turn: GameState['turn'];
  energyAssignedThisTurn: boolean;
  playerActive: ReturnType<typeof mapBattlerForSimpleContract>;
  npcActive: ReturnType<typeof mapBattlerForSimpleContract>;
  supportedActions: NpcActionType[];
};

type LegacyNpcRequest = {
  estado_partida: {
    id_partida: number;
    fase: GameState['phase'];
    turno: 'jugador' | 'npc';
    energia_asignada_en_turno: boolean;
    pokemon_jugador: ReturnType<typeof mapBattlerForLegacyContract>;
    pokemon_npc: ReturnType<typeof mapBattlerForLegacyContract>;
  };
  consulta: string;
};

function mapBattlerForSimpleContract(battler: Battler | null) {
  if (!battler) {
    return null;
  }

  return {
    id: battler.id,
    name: battler.name,
    hp: battler.currentHp,
    maxHp: battler.hp,
    energy: battler.energy,
    attackName: battler.attackName,
    attackCost: battler.attackCost,
    attackDamage: battler.attackDamage,
  };
}

function mapBattlerForLegacyContract(battler: Battler | null) {
  if (!battler) {
    return null;
  }

  return {
    nombre: battler.name,
    hp_actual: battler.currentHp,
    hp_maximo: battler.hp,
    energia: battler.energy,
    costo_ataque: battler.attackCost,
    danio_ataque: battler.attackDamage,
    ataque: battler.attackName,
  };
}

function normalizeActionType(value: unknown): NpcActionType | null {
  if (typeof value !== 'string') {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case 'attack':
    case 'atacar':
      return 'attack';
    case 'attach-energy':
    case 'attach_energy':
    case 'asignar-energia':
    case 'asignar_energia':
    case 'energia':
      return 'attach-energy';
    case 'pass':
    case 'pasar':
      return 'pass';
    default:
      return null;
  }
}

function parseNpcAction(payload: unknown): NpcAction {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Respuesta NPC inválida: no es un objeto JSON.');
  }

  const candidate = payload as {
    type?: unknown;
    action?: unknown;
    accion?: unknown;
    reason?: unknown;
    razon?: unknown;
    message?: unknown;
    decision?: {
      type?: unknown;
      action?: unknown;
      accion?: unknown;
      reason?: unknown;
      razon?: unknown;
    };
  };

  const actionType =
    normalizeActionType(candidate.type) ??
    normalizeActionType(candidate.action) ??
    normalizeActionType(candidate.accion) ??
    normalizeActionType(candidate.decision?.type) ??
    normalizeActionType(candidate.decision?.action) ??
    normalizeActionType(candidate.decision?.accion);

  if (!actionType) {
    throw new Error('Respuesta NPC inválida: acción no reconocida.');
  }

  const reason =
    typeof candidate.reason === 'string'
      ? candidate.reason
      : typeof candidate.razon === 'string'
        ? candidate.razon
        : typeof candidate.message === 'string'
          ? candidate.message
          : typeof candidate.decision?.reason === 'string'
            ? candidate.decision.reason
            : typeof candidate.decision?.razon === 'string'
              ? candidate.decision.razon
              : undefined;

  return {
    type: actionType,
    reason,
    source: 'http',
  };
}

function buildSimpleRequest(state: GameState): SimpleNpcRequest {
  return {
    matchId: state.matchId,
    phase: state.phase,
    turn: state.turn,
    energyAssignedThisTurn: state.energyAssignedThisTurn,
    playerActive: mapBattlerForSimpleContract(state.playerActive),
    npcActive: mapBattlerForSimpleContract(state.npcActive),
    supportedActions: ['attach-energy', 'attack', 'pass'],
  };
}

function buildLegacyRequest(state: GameState): LegacyNpcRequest {
  return {
    estado_partida: {
      id_partida: state.matchId,
      fase: state.phase,
      turno: state.turn === 'player' ? 'jugador' : 'npc',
      energia_asignada_en_turno: state.energyAssignedThisTurn,
      pokemon_jugador: mapBattlerForLegacyContract(state.playerActive),
      pokemon_npc: mapBattlerForLegacyContract(state.npcActive),
    },
    consulta: 'Decidí una acción mínima para el NPC: attach-energy, attack o pass.',
  };
}

function createAbortErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}

export class HttpNpcService implements NpcService {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: HttpNpcServiceOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private buildRequestBody(state: GameState): SimpleNpcRequest | LegacyNpcRequest {
    return this.options.contract === 'legacy-batalla-accion'
      ? buildLegacyRequest(state)
      : buildSimpleRequest(state);
  }

  async decideAction(state: GameState): Promise<NpcAction> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildRequestBody(state)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      return parseNpcAction(payload);
    } catch (error) {
      const fallbackAction = await this.options.fallbackService.decideAction(state);

      return {
        ...fallbackAction,
        source: 'mock',
        notice: `Backend NPC no disponible (${createAbortErrorMessage(error)}). Se usa mock local en este turno.`,
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
