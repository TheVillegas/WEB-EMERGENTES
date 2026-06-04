import type { Battler, DeckType, GameState } from './types';
import type { Card } from '../cards/types';
import type { PvpRole } from '../multiplayer/multiplayerService';

const DEFAULT_HAND_SIZE = 3;

function getDeckCards(catalog: Card[], type: DeckType): Card[] {
  return catalog.filter(
    (card) =>
      card.type.toLowerCase().includes(type.toLowerCase()) ||
      (type === 'Fuego' && card.type === 'Fire') ||
      (type === 'Agua' && card.type === 'Water') ||
      (type === 'Planta' && card.type === 'Grass'),
  ).slice(0, 10);
}

/**
 * Creates a PvP match.
 *
 * Key differences from a normal (NPC) match:
 * - No NPC active card is pre-selected. The opponent will select their own.
 * - Player 1 goes first (selects active card first).
 * - Player 2 waits for opponent to select first, then selects.
 */
export function createPvpMatch(
  catalog: Card[],
  matchId: number,
  deckType: DeckType = 'Fuego',
  role: PvpRole = 'player1',
  handSize: number = DEFAULT_HAND_SIZE,
): GameState {
  const playerPool = getDeckCards(catalog, deckType);
  const playerHand =
    playerPool.length >= handSize
      ? playerPool.slice(0, handSize)
      : catalog.slice(0, handSize);

  return {
    phase: 'selecting-active',
    turn: 'player',
    winner: null,
    catalog,
    playerHand,
    npcHand: [], // opponent manages their own hand
    playerActive: null,
    npcActive: null, // will be set when opponent selects their card
    log: ['¡Batalla PvP iniciada!', role === 'player1' ? 'Eres el Jugador 1 — selecciona tu carta activa.' : 'Eres el Jugador 2 — selecciona tu carta activa.'],
    pendingNpc: false,
    matchId,
    energyAssignedThisTurn: false,
  };
}
