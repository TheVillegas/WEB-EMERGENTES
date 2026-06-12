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
import { canEvolveInto } from './evolution';
import { resolveTrainerEffect } from './trainerEffects';

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
      turnPhase: state.turnPhase === 'draw' ? 'main' : state.turnPhase,
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
  const attackLog = `${attacker.activeBattler.card.name} usó ${attackData.name} e hizo ${damage} de daño a ${defender.activeBattler.card.name}.`;

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

    const koLog = `${knockedBattler.card.name} fue derrotado. +${points} punto(s) para el atacante.`;

    if (defender.bench.length > 0) {
      // Defender needs to choose a replacement — we set active to null
      // The UI will handle showing the selection modal
      updatedState = {
        ...updatedState,
        players: {
          ...updatedState.players,
          [attackerId]: updatedAttacker,
          [defenderId]: updatedDefender,
        },
        turnPhase: 'end',
        log: [...updatedState.log, attackLog, koLog, `${defenderId} debe elegir un Pokémon de la banca.`],
      };
    } else {
      // No bench = loss
      updatedState = {
        ...updatedState,
        winner: attackerId,
        players: {
          ...updatedState.players,
          [attackerId]: updatedAttacker,
          [defenderId]: updatedDefender,
        },
        turnPhase: 'end',
        gamePhase: 'ended',
        log: [...updatedState.log, attackLog, koLog, `${defenderId} no tiene Pokémon en la banca. ¡${attackerId} gana!`],
      };
    }

    // Check points victory
    if (updatedAttacker.points >= 3 && !updatedState.winner) {
      updatedState = {
        ...updatedState,
        winner: attackerId,
        gamePhase: 'ended',
        log: [...updatedState.log, `${attackerId} alcanzó ${updatedAttacker.points} puntos. ¡Victoria!`],
      };
    }
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
      log: [...updatedState.log, attackLog],
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
  if (player.hasRetreated) {
    return { success: false, state: null, error: 'Already retreated this turn' };
  }
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
    hasRetreated: true,
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
        hasEvolved: false,
        hasRetreated: false,
      },
    },
    log: [...state.log, `Turno de ${nextPlayer}.`],
  };

  // Generate energy for the next player (not on their first turn)
  // Bug #6: Use diceRoll to determine who actually started (odd = turnOrder[1])
  const firstPlayer = state.diceRoll
    ? (state.diceRoll % 2 === 0 ? state.turnOrder[0] : state.turnOrder[1])
    : state.turnOrder[0];
  if (nextPlayer !== firstPlayer || updatedState.turnNumber > 2) {
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
    if (player.deck.length === 0) {
      return { ...state, log: [...state.log, `${playerId === 'player' ? 'Jugador' : 'Rival'} no tiene cartas en el mazo.`] };
    }
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
  targetInfo?: { target: 'active' | 'bench' | 'opponent-active' | 'opponent-bench'; benchIndex?: number },
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

  let updatedState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    log: [...state.log, `Se jugó ${trainer.name}.`],
  };

  // Resolve the actual trainer effect
  updatedState = resolveTrainerEffect(updatedState, playerId, trainer.name, targetInfo);

  return {
    success: true,
    state: updatedState,
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

// ─── Evolution ───────────────────────────────────────────────────────

function emptyEnergyZone(): Record<EnergyType, number> {
  const zone = {} as Record<EnergyType, number>;
  for (const type of ALL_ENERGY_TYPES) {
    zone[type] = 0;
  }
  return zone;
}

/**
 * Evolve a Pokemon in play using a card from the player's hand.
 * The evolution card must be a stage1/stage2 that evolves from the target Pokemon.
 * Energies are preserved, HP is set to the evolution's max HP.
 */
export function evolvePokemon(
  state: GameState,
  playerId: string,
  handCardIndex: number,
  target: 'active' | 'bench',
  benchIndex?: number,
): ActionResult {
  if (state.currentTurn !== playerId) {
    return { success: false, state: null, error: 'Not your turn' };
  }
  if (state.turnPhase !== 'main') {
    return { success: false, state: null, error: 'Wrong phase' };
  }

  const player = state.players[playerId];

  if (player.hasEvolved) {
    return { success: false, state: null, error: 'Ya evolucionaste un Pok\u00e9mon este turno' };
  }

  const card = player.hand[handCardIndex];
  if (!card || !isPokemonCard(card)) {
    return { success: false, state: null, error: 'Invalid card' };
  }

  const pokemonCard = card as PokemonCard;
  if (pokemonCard.stage === 'basic') {
    return { success: false, state: null, error: 'No se puede jugar un b\u00e1sico como evoluci\u00f3n' };
  }

  let targetBattler: Battler | null = null;
  if (target === 'active') {
    targetBattler = player.activeBattler;
  } else if (target === 'bench' && benchIndex !== undefined) {
    targetBattler = player.bench[benchIndex] ?? null;
  }

  if (!targetBattler) {
    return { success: false, state: null, error: 'Invalid target' };
  }

  // Check evolution chain
  if (!canEvolveInto(targetBattler.card.name, pokemonCard.name)) {
    return { success: false, state: null, error: `${pokemonCard.name} no evoluciona de ${targetBattler.card.name}` };
  }

  // Create evolved battler: keep energies, set HP to new max
  const evolvedBattler: Battler = {
    card: pokemonCard,
    currentHp: pokemonCard.hp,
    attachedEnergies: { ...targetBattler.attachedEnergies },
    status: targetBattler.status,
  };

  const newHand = player.hand.filter((_, i) => i !== handCardIndex);
  const updatedPlayer: PlayerState = {
    ...player,
    hand: newHand,
    discard: [...player.discard, targetBattler.card], // Old card goes to discard
    hasEvolved: true,
  };

  if (target === 'active') {
    updatedPlayer.activeBattler = evolvedBattler;
  } else if (benchIndex !== undefined) {
    updatedPlayer.bench = player.bench.map((b, i) => (i === benchIndex ? evolvedBattler : b));
  }

  return {
    success: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      log: [...state.log, `${targetBattler.card.name} evolucion\u00f3 a ${pokemonCard.name}!`],
    },
    error: null,
  };
}

// ─── Forced Switch (KO) ─────────────────────────────────────────────

/**
 * Switch a bench Pokemon to active after the current active was KO'd.
 * No retreat cost is paid.
 */
export function forceSwitchOnKO(
  state: GameState,
  playerId: string,
  benchIndex: number,
): ActionResult {
  const player = state.players[playerId];

  if (player.activeBattler !== null) {
    return { success: false, state: null, error: 'Active Pokemon still alive' };
  }
  if (player.bench.length === 0) {
    return { success: false, state: null, error: 'No bench Pokemon' };
  }
  if (benchIndex < 0 || benchIndex >= player.bench.length) {
    return { success: false, state: null, error: 'Invalid bench index' };
  }

  const newActive = { ...player.bench[benchIndex], status: 'active' as const };
  const newBench = [
    ...player.bench.slice(0, benchIndex),
    ...player.bench.slice(benchIndex + 1),
  ];

  return {
    success: true,
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          activeBattler: newActive,
          bench: newBench,
        },
      },
      log: [...state.log, `${newActive.card.name} entra al combate desde la banca.`],
    },
    error: null,
  };
}
