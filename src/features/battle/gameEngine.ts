import type { Battler, DeckType, Difficulty, GameState, TurnOwner, Winner } from './types';
import type { Card } from '../cards/types';

const DEFAULT_HAND_SIZE = 3;

export function getDeckCards(catalog: Card[], type: DeckType): Card[] {
  return catalog.filter((card) => card.type.toLowerCase().includes(type.toLowerCase()) || type === 'Fuego' && card.type === 'Fire' || type === 'Agua' && card.type === 'Water' || type === 'Planta' && card.type === 'Grass').slice(0, 10);
}

function getNpcCards(catalog: Card[], difficulty: Difficulty): Card[] {
  // En dificultad fácil, elegimos cartas débiles (bajo HP)
  // En normal, las siguientes
  // En difícil, las de mayor HP
  const sorted = [...catalog].sort((a, b) => a.hp - b.hp);
  if (difficulty === 'Fácil') return sorted.slice(0, 10);
  if (difficulty === 'Difícil') return sorted.slice(-10).reverse();
  return catalog.slice(10, 20); // Normal
}

function appendLog(log: string[], entry: string): string[] {
  return [...log, entry];
}

function createBattler(card: Card): Battler {
  return {
    ...card,
    currentHp: card.hp,
    energy: 0,
  };
}

function replaceActive(state: GameState, owner: TurnOwner, battler: Battler | null): GameState {
  return owner === 'player' ? { ...state, playerActive: battler } : { ...state, npcActive: battler };
}

export function createMatch(catalog: Card[], matchId: number, deckType: DeckType = 'Fuego', difficulty: Difficulty = 'Normal', handSize: number = DEFAULT_HAND_SIZE, customDeckIds?: string[]): GameState {
  let playerPool: Card[] = [];
  if (customDeckIds && customDeckIds.length > 0) {
    playerPool = customDeckIds.map((id) => catalog.find((c) => c.id === id)).filter(Boolean) as Card[];
  }
  
  if (playerPool.length === 0) {
    playerPool = getDeckCards(catalog, deckType);
  }

  const playerHand = playerPool.length >= handSize ? playerPool.slice(0, handSize) : catalog.slice(0, handSize);
  
  const npcPool = getNpcCards(catalog, difficulty);
  const npcActiveCard = npcPool[0] ?? catalog[handSize] ?? catalog[0] ?? null;

  return {
    phase: 'selecting-active',
    turn: 'player',
    winner: null,
    catalog,
    playerHand,
    npcHand: npcPool.slice(npcActiveCard ? 1 : 0),
    playerActive: null,
    npcActive: npcActiveCard ? createBattler(npcActiveCard) : null,
    log: ['Nueva partida iniciada.', npcActiveCard ? `NPC activa a ${npcActiveCard.name}.` : 'NPC sin carta activa.'],
    pendingNpc: false,
    matchId,
    energyAssignedThisTurn: false,
  };
}

export function playCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'selecting-active' || state.playerActive) {
    return state;
  }

  const selected = state.playerHand.find((card) => card.id === cardId);

  if (!selected) {
    return state;
  }

  return {
    ...state,
    phase: 'player-turn',
    playerActive: createBattler(selected),
    playerHand: state.playerHand.filter((card) => card.id !== cardId),
    log: appendLog(state.log, `Elegiste a ${selected.name} como Pokémon activo.`),
  };
}

export function canAttack(battler: Battler | null): boolean {
  return Boolean(battler && battler.currentHp > 0 && battler.energy >= battler.attackCost);
}

function getActive(state: GameState, owner: TurnOwner): Battler | null {
  return owner === 'player' ? state.playerActive : state.npcActive;
}

function getDefender(state: GameState, owner: TurnOwner): Battler | null {
  return owner === 'player' ? state.npcActive : state.playerActive;
}

export function assignEnergy(state: GameState, owner: TurnOwner): GameState {
  if (state.phase === 'game-over' || state.energyAssignedThisTurn || state.turn !== owner) {
    return state;
  }

  const active = getActive(state, owner);

  if (!active) {
    return state;
  }

  const updated = { ...active, energy: active.energy + 1 };
  const actorName = owner === 'player' ? 'Jugador' : 'NPC';

  return replaceActive(
    {
      ...state,
      energyAssignedThisTurn: true,
      log: appendLog(state.log, `${actorName} asignó 1 energía a ${active.name} (${updated.energy}/${active.attackCost}).`),
    },
    owner,
    updated,
  );
}

function nextTurnState(state: GameState, nextTurn: TurnOwner): GameState {
  return {
    ...state,
    turn: nextTurn,
    phase: nextTurn === 'player' ? 'player-turn' : 'npc-turn',
    pendingNpc: nextTurn === 'npc',
    energyAssignedThisTurn: false,
  };
}

export function passTurn(state: GameState, owner: TurnOwner, reason?: string): GameState {
  if (state.phase === 'game-over' || state.turn !== owner) {
    return state;
  }

  const actorName = owner === 'player' ? 'Jugador' : 'NPC';
  const nextTurn = owner === 'player' ? 'npc' : 'player';

  return nextTurnState(
    {
      ...state,
      log: appendLog(state.log, `${actorName} pasó el turno${reason ? `: ${reason}` : '.'}`),
    },
    nextTurn,
  );
}

export function checkVictory(state: GameState): Winner {
  if ((state.npcActive?.currentHp ?? 0) <= 0) {
    return 'player';
  }

  if ((state.playerActive?.currentHp ?? 0) <= 0) {
    return 'npc';
  }

  return null;
}

export function resolveAttack(state: GameState, owner: TurnOwner): GameState {
  if (state.phase === 'game-over' || state.turn !== owner) {
    return state;
  }

  const attacker = getActive(state, owner);
  const defender = getDefender(state, owner);

  if (!attacker || !defender || !canAttack(attacker)) {
    return state;
  }

  const updatedDefender = {
    ...defender,
    currentHp: Math.max(0, defender.currentHp - attacker.attackDamage),
  };
  const defendedOwner = owner === 'player' ? 'npc' : 'player';
  const actorName = owner === 'player' ? 'Jugador' : 'NPC';

  const attackedState = replaceActive(
    {
      ...state,
      log: appendLog(
        state.log,
        `${actorName} usó ${attacker.attackName} con ${attacker.name} e hizo ${attacker.attackDamage} de daño a ${defender.name}.`,
      ),
    },
    defendedOwner,
    updatedDefender,
  );

  const winner = checkVictory(attackedState);

  if (winner) {
    const resultLine = winner === 'player' ? 'Victoria del jugador.' : 'Derrota del jugador.';

    return {
      ...attackedState,
      winner,
      phase: 'game-over',
      pendingNpc: false,
      log: appendLog(attackedState.log, resultLine),
    };
  }

  return nextTurnState(attackedState, owner === 'player' ? 'npc' : 'player');
}

export function resetMatch(state: GameState): GameState {
  return createMatch(state.catalog, state.matchId + 1); // Note: In store, we pass deck and difficulty directly now
}
