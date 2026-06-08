import type { Battler, EnergyType, GameState, PlayerState, PokemonCard, TcgCard } from './types';
import { ALL_ENERGY_TYPES } from './types';

export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function emptyEnergyZone(): Record<EnergyType, number> {
  const zone = {} as Record<EnergyType, number>;
  for (const type of ALL_ENERGY_TYPES) {
    zone[type] = 0;
  }
  return zone;
}

export function drawCards(
  player: PlayerState,
  count: number,
): { player: PlayerState; drawn: TcgCard[] } {
  const availableSpace = Math.max(0, 10 - player.hand.length);
  const drawCount = Math.min(count, availableSpace, player.deck.length);
  const drawn = player.deck.slice(0, drawCount);
  const remainingDeck = player.deck.slice(drawCount);

  return {
    player: {
      ...player,
      hand: [...player.hand, ...drawn],
      deck: remainingDeck,
    },
    drawn,
  };
}

function createEmptyPlayerState(): PlayerState {
  return {
    hand: [],
    deck: [],
    discard: [],
    bench: [],
    energyZone: emptyEnergyZone(),
    points: 0,
    activeBattler: null,
    hasAttachedEnergy: false,
    hasUsedSupporter: false,
    hasEvolved: false,
    hasRetreated: false,
  };
}

export function isPokemonCard(card: TcgCard): card is PokemonCard {
  return 'types' in card && Array.isArray((card as PokemonCard).types);
}

export function isBasicPokemon(card: TcgCard): boolean {
  if (!isPokemonCard(card)) return false;
  return (card as PokemonCard).stage === 'basic';
}

export function createBattler(card: PokemonCard, status: 'active' | 'bench'): Battler {
  return {
    card,
    currentHp: card.hp,
    attachedEnergies: emptyEnergyZone(),
    status,
  };
}

/**
 * Roll a dice (1-6). Even = player1 starts, Odd = player2 starts.
 */
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Determine which player goes first based on dice roll.
 * Even = player1 (index 0), Odd = player2 (index 1).
 */
export function determineFirstPlayer(roll: number, turnOrder: string[]): string {
  return roll % 2 === 0 ? turnOrder[0] : turnOrder[1];
}

/**
 * Validate that a hand has at least one basic Pokemon.
 * If not, reshuffle and redraw (up to maxRetries times).
 * If all retries fail, search the deck for the first basic Pokemon.
 */
function ensureBasicPokemonInHand(
  deck: TcgCard[],
  handSize: number,
  maxRetries: number = 3,
): { hand: TcgCard[]; deck: TcgCard[] } {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const shuffled = attempt === 0 ? deck : shuffleArray(deck);
    const hand = shuffled.slice(0, handSize);
    const remaining = shuffled.slice(handSize);

    const hasBasic = hand.some(isBasicPokemon);
    if (hasBasic) {
      return { hand, deck: remaining };
    }

    // Last attempt: force a basic Pokemon into the hand
    if (attempt === maxRetries) {
      const basicIdx = shuffled.findIndex(isBasicPokemon);
      if (basicIdx >= 0 && basicIdx >= handSize) {
        // Swap the first non-basic in hand with the found basic
        const forcedHand = [...hand];
        forcedHand[0] = shuffled[basicIdx];
        const forcedDeck = [...remaining];
        // Put the replaced card back
        forcedDeck.push(hand[0]);
        return { hand: forcedHand, deck: forcedDeck };
      }
      // If no basic at all in the deck, just return what we have
      return { hand, deck: remaining };
    }
  }

  // Fallback (should not reach)
  return { hand: deck.slice(0, handSize), deck: deck.slice(handSize) };
}

/**
 * Create the initial game state. 
 * - Shuffles both decks
 * - Draws 5 cards per player with basic Pokemon guarantee
 * - Does NOT auto-assign active Pokemon (players must select)
 * - Rolls dice for turn order
 */
export function createInitialState(
  player1Deck: TcgCard[],
  player2Deck: TcgCard[],
  player1Id: string,
  player2Id: string,
): GameState {
  const shuffled1 = shuffleArray(player1Deck);
  const shuffled2 = shuffleArray(player2Deck);

  const p1Result = ensureBasicPokemonInHand(shuffled1, 5);
  const p2Result = ensureBasicPokemonInHand(shuffled2, 5);

  const p1: PlayerState = {
    ...createEmptyPlayerState(),
    hand: p1Result.hand,
    deck: p1Result.deck,
  };

  const p2: PlayerState = {
    ...createEmptyPlayerState(),
    hand: p2Result.hand,
    deck: p2Result.deck,
  };

  const dice = rollDice();
  const turnOrder = [player1Id, player2Id];
  const firstPlayer = determineFirstPlayer(dice, turnOrder);

  return {
    players: {
      [player1Id]: p1,
      [player2Id]: p2,
    },
    currentTurn: firstPlayer,
    turnPhase: 'main', // Setup phase — players select active Pokemon
    turnNumber: 1,
    winner: null,
    turnOrder,
    log: [
      'Nueva partida iniciada.',
      `Dado: ${dice} — ${dice % 2 === 0 ? 'Par' : 'Impar'} — Empieza ${firstPlayer === player1Id ? 'Jugador' : 'Rival'}.`,
    ],
    gamePhase: 'setup',
    diceRoll: dice,
  };
}
