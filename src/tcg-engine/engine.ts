import type {
  Battler,
  EnergyType,
  EnergyZone,
  GameState,
  PlayerState,
  PokemonCard,
  TcgCard,
  TrainerCard,
  ActionResult,
} from './types';
import { ALL_ENERGY_TYPES } from './types';

export function getRandomEnergyType(): EnergyType {
  return ALL_ENERGY_TYPES[Math.floor(Math.random() * ALL_ENERGY_TYPES.length)];
}

export function isPokemonCard(card: TcgCard): card is PokemonCard {
  return 'types' in card && Array.isArray((card as PokemonCard).types);
}

export function isTrainerCard(card: TcgCard): card is TrainerCard {
  return 'type' in card && ['item', 'supporter', 'stadium'].includes((card as TrainerCard).type);
}

export function generateEnergy(state: GameState, playerId: string): GameState {
  if (state.turnNumber === 1) {
    return state;
  }
  const player = state.players[playerId];
  const type = getRandomEnergyType();
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        energyZone: {
          ...player.energyZone,
          [type]: player.energyZone[type] + 1,
        },
      },
    },
  };
}

export function getAvailableEnergyTypes(zone: EnergyZone): EnergyType[] {
  return ALL_ENERGY_TYPES.filter((t) => zone[t] > 0);
}

export function attachEnergy(
  state: GameState,
  playerId: string,
  target: 'active' | 'bench',
  benchIndex?: number,
): ActionResult {
  if (state.currentTurn !== playerId) {
    return { success: false, state: null, error: 'Not your turn' };
  }
  if (state.turnPhase !== 'main' && state.turnPhase !== 'draw') {
    return { success: false, state: null, error: 'Wrong phase' };
  }
  if (state.turnNumber === 1) {
    return { success: false, state: null, error: 'Cannot attach energy on first turn' };
  }

  const player = state.players[playerId];
  if (player.hasAttachedEnergy) {
    return { success: false, state: null, error: 'Energy already attached this turn' };
  }

  const available = getAvailableEnergyTypes(player.energyZone);
  if (available.length === 0) {
    return { success: false, state: null, error: 'No energy in zone' };
  }

  const type = available[0];

  let battler: Battler | null = null;
  if (target === 'active') {
    battler = player.activeBattler;
  } else if (target === 'bench' && benchIndex !== undefined) {
    battler = player.bench[benchIndex] ?? null;
  }

  if (!battler) {
    return { success: false, state: null, error: 'Invalid target' };
  }

  const updatedBattler: Battler = {
    ...battler,
    attachedEnergies: {
      ...battler.attachedEnergies,
      [type]: battler.attachedEnergies[type] + 1,
    },
  };

  const updatedPlayer: PlayerState = {
    ...player,
    energyZone: {
      ...player.energyZone,
      [type]: player.energyZone[type] - 1,
    },
    hasAttachedEnergy: true,
  };

  if (target === 'active') {
    updatedPlayer.activeBattler = updatedBattler;
  } else if (benchIndex !== undefined) {
    updatedPlayer.bench = player.bench.map((b, i) => (i === benchIndex ? updatedBattler : b));
  }

  return {
    success: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
    },
    error: null,
  };
}

export function validateAttackCost(
  battler: Battler,
  cost: EnergyType[],
): { valid: boolean; missing: Partial<Record<EnergyType, number>> } {
  const totalEnergy = Object.values(battler.attachedEnergies).reduce((a, b) => a + b, 0);
  const totalCost = cost.length;

  if (totalEnergy >= totalCost) {
    return { valid: true, missing: {} };
  }

  // Report generic missing energy
  return { valid: false, missing: { colorless: totalCost - totalEnergy } };
}

export function applyWeakness(baseDamage: number, attackerType: EnergyType, defenderWeakness: EnergyType | null): number {
  if (defenderWeakness && defenderWeakness === attackerType) {
    return baseDamage + 20;
  }
  return baseDamage;
}

export function countEnergies(battler: Battler): number {
  return Object.values(battler.attachedEnergies).reduce((a, b) => a + b, 0);
}

export function discardEnergiesForRetreat(
  battler: Battler,
  count: number,
): { battler: Battler; discarded: EnergyType[] } {
  const updated = { ...battler, attachedEnergies: { ...battler.attachedEnergies } };
  const discarded: EnergyType[] = [];
  let remaining = count;

  for (const type of ALL_ENERGY_TYPES) {
    while (remaining > 0 && updated.attachedEnergies[type] > 0) {
      updated.attachedEnergies[type] = updated.attachedEnergies[type] - 1;
      discarded.push(type);
      remaining--;
    }
    if (remaining <= 0) break;
  }

  return { battler: updated, discarded };
}

export function attack(
  state: GameState,
  attackerId: string,
  attackIndex: number,
): ActionResult {
  if (state.currentTurn !== attackerId) {
    return { success: false, state: null, error: 'Not your turn' };
  }
  if (state.turnPhase !== 'main' && state.turnPhase !== 'attack') {
    return { success: false, state: null, error: 'Wrong phase' };
  }
  if (state.turnNumber === 1) {
    return { success: false, state: null, error: 'Cannot attack on first turn' };
  }

  const attacker = state.players[attackerId];
  const defenderId = state.turnOrder.find((id) => id !== attackerId)!;
  const defender = state.players[defenderId];

  if (!attacker.activeBattler) {
    return { success: false, state: null, error: 'No active Pokemon' };
  }
  if (!defender.activeBattler) {
    return { success: false, state: null, error: 'Opponent has no active Pokemon' };
  }

  const attackData = attacker.activeBattler.card.attacks[attackIndex];
  if (!attackData) {
    return { success: false, state: null, error: 'Invalid attack index' };
  }

  const costCheck = validateAttackCost(attacker.activeBattler, attackData.cost);
  if (!costCheck.valid) {
    return { success: false, state: null, error: 'Not enough energy' };
  }

  const attackerType = attacker.activeBattler.card.types[0];
  const damage = applyWeakness(attackData.damage, attackerType, defender.activeBattler.card.weakness);

  const newDefenderHp = defender.activeBattler.currentHp - damage;
  let updatedState = { ...state };

  if (newDefenderHp <= 0) {
    // KO
    const points = defender.activeBattler.card.isEx ? 2 : 1;
    const updatedAttacker: PlayerState = {
      ...attacker,
      points: attacker.points + points,
    };

    const knockedBattler = defender.activeBattler;
    const updatedDefender: PlayerState = {
      ...defender,
      activeBattler: null,
      discard: [...defender.discard, knockedBattler.card],
    };

    // Force switch if bench available
    if (defender.bench.length > 0) {
      const newActive = defender.bench[0];
      updatedDefender.activeBattler = { ...newActive, status: 'active' };
      updatedDefender.bench = defender.bench.slice(1);
    } else {
      // No bench = loss
      updatedState.winner = attackerId;
    }

    updatedState = {
      ...updatedState,
      players: {
        ...updatedState.players,
        [attackerId]: updatedAttacker,
        [defenderId]: updatedDefender,
      },
      turnPhase: 'end',
    };
  } else {
    const updatedDefender: PlayerState = {
      ...defender,
      activeBattler: {
        ...defender.activeBattler,
        currentHp: newDefenderHp,
      },
    };

    updatedState = {
      ...updatedState,
      players: {
        ...updatedState.players,
        [defenderId]: updatedDefender,
      },
      turnPhase: 'end',
    };
  }

  return { success: true, state: updatedState, error: null };
}

export function switchActive(
  state: GameState,
  playerId: string,
  benchIndex: number,
): ActionResult {
  if (state.currentTurn !== playerId) {
    return { success: false, state: null, error: 'Not your turn' };
  }
  if (state.turnPhase !== 'main') {
    return { success: false, state: null, error: 'Wrong phase' };
  }

  const player = state.players[playerId];
  if (player.bench.length === 0) {
    return { success: false, state: null, error: 'No bench Pokemon' };
  }
  if (benchIndex < 0 || benchIndex >= player.bench.length) {
    return { success: false, state: null, error: 'Invalid bench index' };
  }
  if (!player.activeBattler) {
    return { success: false, state: null, error: 'No active Pokemon' };
  }

  const retreatCost = player.activeBattler.card.retreatCost;
  if (retreatCost > 0 && countEnergies(player.activeBattler) < retreatCost) {
    return { success: false, state: null, error: 'Not enough energy to retreat' };
  }

  const { battler: retreatedBattler, discarded } = discardEnergiesForRetreat(
    player.activeBattler,
    retreatCost,
  );

  const newActive = { ...player.bench[benchIndex], status: 'active' as const };
  const newBench = [
    ...player.bench.slice(0, benchIndex),
    ...player.bench.slice(benchIndex + 1),
    { ...retreatedBattler, status: 'bench' as const },
  ];

  const updatedPlayer: PlayerState = {
    ...player,
    activeBattler: newActive,
    bench: newBench,
  };

  return {
    success: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
    },
    error: null,
  };
}

export function endTurn(state: GameState): GameState {
  const nextIndex = (state.turnOrder.indexOf(state.currentTurn) + 1) % state.turnOrder.length;
  const nextPlayer = state.turnOrder[nextIndex];
  const currentPlayerId = state.currentTurn;

  let updatedState: GameState = {
    ...state,
    currentTurn: nextPlayer,
    turnNumber: state.turnNumber + 1,
    turnPhase: 'draw',
    players: {
      ...state.players,
      [currentPlayerId]: {
        ...state.players[currentPlayerId],
        hasAttachedEnergy: false,
        hasUsedSupporter: false,
      },
    },
  };

  // Generate energy for the next player (not on their first turn)
  if (updatedState.turnNumber > 2 || nextPlayer !== state.turnOrder[0]) {
    updatedState = generateEnergy(updatedState, nextPlayer);
  }

  return updatedState;
}

export function drawCard(state: GameState, playerId: string): GameState {
  if (state.turnNumber === 1) {
    return state;
  }

  const player = state.players[playerId];
  if (player.hand.length >= 10 || player.deck.length === 0) {
    return state;
  }

  const card = player.deck[0];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: [...player.hand, card],
        deck: player.deck.slice(1),
      },
    },
  };
}

export function useTrainer(
  state: GameState,
  playerId: string,
  cardIndex: number,
): ActionResult {
  if (state.currentTurn !== playerId) {
    return { success: false, state: null, error: 'Not your turn' };
  }
  if (state.turnPhase !== 'main') {
    return { success: false, state: null, error: 'Wrong phase' };
  }

  const player = state.players[playerId];
  const card = player.hand[cardIndex];
  if (!card) {
    return { success: false, state: null, error: 'Invalid card index' };
  }

  if (!isTrainerCard(card)) {
    return { success: false, state: null, error: 'Not a trainer card' };
  }

  const trainer = card as TrainerCard;

  if (trainer.type === 'supporter' && player.hasUsedSupporter) {
    return { success: false, state: null, error: 'Supporter already played this turn' };
  }

  const newHand = player.hand.filter((_, i) => i !== cardIndex);
  const updatedPlayer: PlayerState = {
    ...player,
    hand: newHand,
    discard: [...player.discard, card],
    hasUsedSupporter: trainer.type === 'supporter' ? true : player.hasUsedSupporter,
  };

  return {
    success: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
    },
    error: null,
  };
}

export function checkVictory(state: GameState): string | null {
  for (const [playerId, player] of Object.entries(state.players)) {
    if (player.points >= 3) {
      return playerId;
    }
  }
  return null;
}
