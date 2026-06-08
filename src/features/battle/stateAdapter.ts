/**
 * State Adapter: Converts the new tcg-engine GameState into the legacy format
 * that ThreeArena and other game/ components expect.
 */
import type { GameState as TcgGameState, Battler as TcgBattler, TcgCard, PokemonCard } from '../../tcg-engine/types';
import type { Battler as LegacyBattler, GameState as LegacyGameState, TurnOwner, TurnPhase } from './types';
import type { Card } from '../cards/types';
import { isPokemonCard } from '../../tcg-engine/engine';

/**
 * Convert a TcgBattler to the legacy Battler format that the 3D scene expects.
 */
export function tcgBattlerToLegacy(battler: TcgBattler | null): LegacyBattler | null {
  if (!battler) return null;

  const totalEnergy = Object.values(battler.attachedEnergies).reduce((a, b) => a + b, 0);
  const attackCost = battler.card.attacks.length > 0 ? battler.card.attacks[0].cost.length : 0;

  return {
    id: battler.card.id,
    name: battler.card.name,
    category: 'Pokémon',
    type: battler.card.types[0] || 'colorless',
    hp: battler.card.hp,
    attackName: battler.card.attacks[0]?.name || 'Golpe',
    attackDamage: battler.card.attacks[0]?.damage || 0,
    attackCost,
    imageSmall: battler.card.imageSmall || '',
    imageLarge: battler.card.imageLarge || '',
    currentHp: battler.currentHp,
    energy: totalEnergy,
  };
}

/**
 * Convert a TcgCard (from hand) to the legacy Card format.
 */
export function tcgCardToLegacy(card: TcgCard): Card {
  if (isPokemonCard(card)) {
    const pokemon = card as PokemonCard;
    return {
      id: pokemon.id,
      name: pokemon.name,
      category: 'Pokémon',
      type: pokemon.types[0] || 'colorless',
      hp: pokemon.hp,
      attackName: pokemon.attacks[0]?.name || 'Golpe',
      attackDamage: pokemon.attacks[0]?.damage || 0,
      attackCost: pokemon.attacks[0]?.cost.length || 0,
      imageSmall: pokemon.imageSmall || '',
      imageLarge: pokemon.imageLarge || '',
    };
  }

  // Trainer card — map to Card format (with 0 combat stats)
  return {
    id: card.id,
    name: card.name,
    category: 'Pokémon', // Legacy type only supports Pokémon
    type: 'Trainer',
    hp: 0,
    attackName: (card as any).effect || '',
    attackDamage: 0,
    attackCost: 0,
    imageSmall: (card as any).imageSmall || '',
    imageLarge: (card as any).imageLarge || '',
  };
}

/**
 * Convert the full tcg-engine GameState to a legacy GameState for ThreeArena.
 */
export function tcgStateToLegacy(
  tcgState: TcgGameState,
  playerId: string,
  opponentId: string,
  catalog: Card[],
  matchId: number,
): LegacyGameState {
  const player = tcgState.players[playerId];
  const opponent = tcgState.players[opponentId];

  const turn: TurnOwner = tcgState.currentTurn === playerId ? 'player' : 'npc';

  let phase: TurnPhase;
  if (tcgState.gamePhase === 'setup') {
    if (!player.activeBattler) {
      phase = 'selecting-active';
    } else if (!opponent.activeBattler) {
      phase = 'opponent-selecting-active';
    } else {
      phase = turn === 'player' ? 'player-turn' : 'npc-turn';
    }
  } else if (tcgState.gamePhase === 'ended' || tcgState.winner) {
    phase = 'game-over';
  } else {
    phase = turn === 'player' ? 'player-turn' : 'npc-turn';
  }

  const winner = tcgState.winner
    ? (tcgState.winner === playerId ? 'player' : 'npc')
    : null;

  return {
    phase,
    turn,
    winner,
    catalog,
    playerHand: player.hand.map(tcgCardToLegacy),
    npcHand: opponent.hand.map(tcgCardToLegacy),
    playerActive: tcgBattlerToLegacy(player.activeBattler),
    npcActive: tcgBattlerToLegacy(opponent.activeBattler),
    log: tcgState.log,
    pendingNpc: turn === 'npc',
    matchId,
    energyAssignedThisTurn: player.hasAttachedEnergy,
  };
}
