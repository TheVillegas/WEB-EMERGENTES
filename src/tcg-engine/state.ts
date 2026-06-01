import type { Battler, EnergyType, GameState, PlayerState, TcgCard } from './types';
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
  };
}

function isPokemonCard(card: TcgCard): card is { card: { types: EnergyType[] } } & TcgCard {
  return 'types' in card && Array.isArray(card.types);
}

function createBattler(card: TcgCard, status: 'active' | 'bench'): Battler | null {
  if (!isPokemonCard(card)) {
    return null;
  }
  return {
    card: card as import('./types').PokemonCard,
    currentHp: card.hp,
    attachedEnergies: emptyEnergyZone(),
    status,
  };
}

export function createInitialState(
  player1Deck: TcgCard[],
  player2Deck: TcgCard[],
  player1Id: string,
  player2Id: string,
): GameState {
  const shuffled1 = shuffleArray(player1Deck);
  const shuffled2 = shuffleArray(player2Deck);

  const p1Drawn = drawCards({ ...createEmptyPlayerState(), deck: shuffled1 }, 5);
  const p2Drawn = drawCards({ ...createEmptyPlayerState(), deck: shuffled2 }, 5);

  let p1 = p1Drawn.player;
  let p2 = p2Drawn.player;

  const p1Pokemon = p1.hand.filter(isPokemonCard);
  const p2Pokemon = p2.hand.filter(isPokemonCard);

  if (p1Pokemon.length > 0) {
    const activeCard = p1Pokemon[0];
    p1.hand = p1.hand.filter((c) => c.id !== activeCard.id);
    p1.activeBattler = createBattler(activeCard, 'active');

    const benchCards = p1.hand.filter(isPokemonCard).slice(0, 3);
    p1.bench = benchCards
      .map((c) => createBattler(c, 'bench'))
      .filter((b): b is Battler => b !== null);
    p1.hand = p1.hand.filter((c) => !p1.bench.some((b) => b.card.id === c.id));
  }

  if (p2Pokemon.length > 0) {
    const activeCard = p2Pokemon[0];
    p2.hand = p2.hand.filter((c) => c.id !== activeCard.id);
    p2.activeBattler = createBattler(activeCard, 'active');

    const benchCards = p2.hand.filter(isPokemonCard).slice(0, 3);
    p2.bench = benchCards
      .map((c) => createBattler(c, 'bench'))
      .filter((b): b is Battler => b !== null);
    p2.hand = p2.hand.filter((c) => !p2.bench.some((b) => b.card.id === c.id));
  }

  return {
    players: {
      [player1Id]: p1,
      [player2Id]: p2,
    },
    currentTurn: player1Id,
    turnPhase: 'draw',
    turnNumber: 1,
    winner: null,
    turnOrder: [player1Id, player2Id],
  };
}
