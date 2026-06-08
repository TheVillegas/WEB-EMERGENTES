import type {
  ActionResult,
  Battler,
  EnergyType,
  GameState,
  PlayerState,
  PokemonCard,
  TcgCard,
  TrainerCard,
} from './types';
import { ALL_ENERGY_TYPES } from './types';
import { isPokemonCard } from './engine';

// ─── Trainer Effect Target Types ─────────────────────────────────────

export type TrainerTargetType =
  | 'none' // no target needed
  | 'own-pokemon' // select one of your own Pokemon (active or bench)
  | 'opponent-pokemon' // select one of opponent's Pokemon
  | 'own-bench' // select from your bench
  | 'opponent-bench' // select from opponent's bench
  | 'discard-pokemon' // select Pokemon from your discard pile
  | 'discard-energy'; // select energy from attached

export interface TrainerEffectTarget {
  targetType: TrainerTargetType;
  description: string;
}

// ─── Trainer Effect Text Map ─────────────────────────────────────────

const TRAINER_EFFECTS: Record<string, { text: string; subtype: 'item' | 'supporter' }> = {
  // Items (no limit per turn)
  'Potion': {
    text: 'Curar 20 HP a uno de tus Pokémon.',
    subtype: 'item',
  },
  'Super Potion': {
    text: 'Descarta 1 energía de uno de tus Pokémon y cura 40 HP.',
    subtype: 'item',
  },
  'Switch': {
    text: 'Cambia tu Pokémon activo por uno de la banca sin pagar costo de retirada.',
    subtype: 'item',
  },
  'Gust of Wind': {
    text: 'Elige un Pokémon de la banca de tu oponente y ponlo como activo.',
    subtype: 'item',
  },
  'Energy Removal': {
    text: 'Elige 1 energía de un Pokémon de tu oponente y descártala.',
    subtype: 'item',
  },
  'Super Energy Removal': {
    text: 'Descarta 1 energía de uno de tus Pokémon. Descarta 2 energías de un Pokémon rival.',
    subtype: 'item',
  },
  'PlusPower': {
    text: 'El siguiente ataque de tu Pokémon activo hace 10 de daño extra este turno.',
    subtype: 'item',
  },
  'Defender': {
    text: 'Tu Pokémon activo recibe 20 de daño menos del próximo ataque rival este turno.',
    subtype: 'item',
  },
  'Item Finder': {
    text: 'Descarta 2 cartas de tu mano. Recupera 1 carta de Entrenador de tu descarte.',
    subtype: 'item',
  },
  'Revive': {
    text: 'Pon un Pokémon básico de tu pila de descarte en tu banca con la mitad de HP.',
    subtype: 'item',
  },
  'Full Heal': {
    text: 'Remueve todas las condiciones de estado de tu Pokémon activo.',
    subtype: 'item',
  },
  'Maintenance': {
    text: 'Pon 2 cartas de tu mano en tu mazo. Luego roba 1 carta.',
    subtype: 'item',
  },
  'Pokédex': {
    text: 'Mira las 5 cartas superiores de tu mazo y reordénalas como quieras.',
    subtype: 'item',
  },
  'Poké Ball': {
    text: 'Lanza una moneda. Si es cara, busca un Pokémon en tu mazo y añádelo a tu mano.',
    subtype: 'item',
  },
  'Scoop Up': {
    text: 'Devuelve uno de tus Pokémon y todas las cartas adjuntas a tu mano.',
    subtype: 'item',
  },
  'Computer Search': {
    text: 'Descarta 2 cartas de tu mano. Busca cualquier carta en tu mazo y añádela a tu mano.',
    subtype: 'item',
  },
  'Devolution Spray': {
    text: 'Devuelve una carta de evolución de uno de tus Pokémon a tu mano.',
    subtype: 'item',
  },
  'Recycle': {
    text: 'Lanza una moneda. Si es cara, pon 1 carta de tu descarte encima de tu mazo.',
    subtype: 'item',
  },
  'Energy Retrieval': {
    text: 'Recupera 2 cartas de energía básica de tu descarte a tu mano.',
    subtype: 'item',
  },
  'Nightly Garbage Run': {
    text: 'Elige hasta 3 cartas de tu descarte (Pokémon y/o energías) y barájalas en tu mazo.',
    subtype: 'item',
  },

  // Supporters (1 per turn)
  'Bill': {
    text: 'Roba 2 cartas de tu mazo.',
    subtype: 'supporter',
  },
  'Professor Oak': {
    text: 'Descarta tu mano. Roba 7 cartas de tu mazo.',
    subtype: 'supporter',
  },
  'Lass': {
    text: 'Ambos jugadores revelan sus manos y barajan las cartas de Entrenador en sus mazos.',
    subtype: 'supporter',
  },
  'Imposter Professor Oak': {
    text: 'Tu oponente baraja su mano en su mazo y roba 7 cartas.',
    subtype: 'supporter',
  },
  'Blaine': {
    text: 'Roba 3 cartas de tu mazo.',
    subtype: 'supporter',
  },
  'Brock': {
    text: 'Cura 20 HP a todos tus Pokémon en juego (activo y banca).',
    subtype: 'supporter',
  },
  'Misty': {
    text: 'Lanza monedas hasta que salga cruz. Por cada cara, asigna 1 energía Agua a uno de tus Pokémon Agua.',
    subtype: 'supporter',
  },
  'Erika': {
    text: 'Cura 20 HP a cada uno de tus Pokémon en juego.',
    subtype: 'supporter',
  },
  'Lt. Surge': {
    text: 'Pon un Pokémon básico de tu mano en tu banca.',
    subtype: 'supporter',
  },
  'Sabrina': {
    text: 'Cambia el Pokémon activo de tu oponente por uno de su banca (tú eliges cuál).',
    subtype: 'supporter',
  },
  'Koga': {
    text: 'Tu Pokémon activo y todas las cartas adjuntas regresan a tu mano.',
    subtype: 'supporter',
  },
  'The Rocket\'s Trap': {
    text: 'Mira la mano de tu oponente. Si tiene alguna carta de Entrenador, descarta 1.',
    subtype: 'supporter',
  },
  'Gambler': {
    text: 'Baraja tu mano en tu mazo. Lanza una moneda: cara = roba 8 cartas, cruz = roba 1.',
    subtype: 'supporter',
  },
  'Copycat': {
    text: 'Baraja tu mano en tu mazo. Roba cartas igual al número que tenía tu oponente en mano.',
    subtype: 'supporter',
  },
};

/**
 * Get the effect text for a trainer card by name.
 * Falls back to a generic message for unknown trainers.
 */
export function getTrainerEffectText(name: string): string {
  return TRAINER_EFFECTS[name]?.text ?? 'Carta de entrenador sin efecto específico.';
}

/**
 * Get the trainer subtype (item vs supporter) by name.
 */
export function getTrainerSubtype(name: string): 'item' | 'supporter' {
  return TRAINER_EFFECTS[name]?.subtype ?? 'item';
}

/**
 * Get what target a trainer card's effect needs.
 */
export function getRequiredTargets(name: string): TrainerEffectTarget | null {
  switch (name) {
    case 'Potion':
    case 'Super Potion':
    case 'Full Heal':
      return { targetType: 'own-pokemon', description: 'Selecciona un Pokémon tuyo' };
    case 'Switch':
      return { targetType: 'own-bench', description: 'Selecciona un Pokémon de tu banca' };
    case 'Gust of Wind':
    case 'Sabrina':
      return { targetType: 'opponent-bench', description: 'Selecciona un Pokémon de la banca rival' };
    case 'Energy Removal':
    case 'Super Energy Removal':
      return { targetType: 'opponent-pokemon', description: 'Selecciona un Pokémon rival' };
    case 'Revive':
      return { targetType: 'discard-pokemon', description: 'Selecciona un Pokémon básico del descarte' };
    default:
      return null;
  }
}

// ─── Helper: create empty energy zone ────────────────────────────────

function emptyEnergyZone(): Record<EnergyType, number> {
  const zone = {} as Record<EnergyType, number>;
  for (const type of ALL_ENERGY_TYPES) {
    zone[type] = 0;
  }
  return zone;
}

// ─── Resolve Trainer Effects ─────────────────────────────────────────

/**
 * Apply the actual effect of a trainer card.
 * @param state Current game state (card already moved to discard by useTrainer)
 * @param playerId The player who used the trainer
 * @param cardName The name of the trainer card
 * @param targetInfo Optional target index for effects that need selection
 */
export function resolveTrainerEffect(
  state: GameState,
  playerId: string,
  cardName: string,
  targetInfo?: { target: 'active' | 'bench' | 'opponent-active' | 'opponent-bench'; benchIndex?: number },
): GameState {
  const player = state.players[playerId];
  const opponentId = state.turnOrder.find((id) => id !== playerId)!;
  const opponent = state.players[opponentId];

  switch (cardName) {
    case 'Potion': {
      // Heal 20 HP to target Pokemon
      return applyHeal(state, playerId, 20, targetInfo);
    }

    case 'Super Potion': {
      // Discard 1 energy from target, heal 40 HP
      let updatedState = applyHeal(state, playerId, 40, targetInfo);
      updatedState = discardOneEnergy(updatedState, playerId, targetInfo);
      return updatedState;
    }

    case 'Bill':
    case 'Blaine': {
      // Draw 2 or 3 cards
      const drawCount = cardName === 'Bill' ? 2 : 3;
      const availableSpace = Math.max(0, 10 - player.hand.length);
      const actualDraw = Math.min(drawCount, availableSpace, player.deck.length);
      const drawnCards = player.deck.slice(0, actualDraw);

      return updatePlayer(state, playerId, {
        hand: [...player.hand, ...drawnCards],
        deck: player.deck.slice(actualDraw),
      });
    }

    case 'Professor Oak': {
      // Discard hand, draw 7
      const drawCount = Math.min(7, player.deck.length);
      const drawnCards = player.deck.slice(0, drawCount);

      return updatePlayer(state, playerId, {
        hand: drawnCards,
        deck: player.deck.slice(drawCount),
        discard: [...player.discard, ...player.hand],
      });
    }

    case 'Switch': {
      // Switch active with bench, no retreat cost
      if (!targetInfo || targetInfo.target !== 'bench' || targetInfo.benchIndex === undefined) return state;
      if (!player.activeBattler || player.bench.length === 0) return state;

      const benchIdx = targetInfo.benchIndex;
      if (benchIdx < 0 || benchIdx >= player.bench.length) return state;

      const newActive = { ...player.bench[benchIdx], status: 'active' as const };
      const newBench = [
        ...player.bench.slice(0, benchIdx),
        ...player.bench.slice(benchIdx + 1),
        { ...player.activeBattler, status: 'bench' as const },
      ];

      return updatePlayer(state, playerId, {
        activeBattler: newActive,
        bench: newBench,
      });
    }

    case 'Gust of Wind':
    case 'Sabrina': {
      // Force switch opponent's active with their bench
      if (!targetInfo || targetInfo.benchIndex === undefined) return state;
      if (!opponent.activeBattler || opponent.bench.length === 0) return state;

      const benchIdx = targetInfo.benchIndex;
      if (benchIdx < 0 || benchIdx >= opponent.bench.length) return state;

      const newActive = { ...opponent.bench[benchIdx], status: 'active' as const };
      const newBench = [
        ...opponent.bench.slice(0, benchIdx),
        ...opponent.bench.slice(benchIdx + 1),
        { ...opponent.activeBattler, status: 'bench' as const },
      ];

      return updatePlayer(state, opponentId, {
        activeBattler: newActive,
        bench: newBench,
      });
    }

    case 'Energy Removal': {
      // Remove 1 energy from opponent's Pokemon
      if (!targetInfo) return state;
      return discardOneEnergy(state, opponentId, {
        target: targetInfo.target === 'opponent-active' ? 'active' : 'bench',
        benchIndex: targetInfo.benchIndex,
      });
    }

    case 'Revive': {
      // Put a basic Pokemon from discard onto bench with half HP
      const basicInDiscard = player.discard.filter(
        (c) => isPokemonCard(c) && (c as PokemonCard).stage === 'basic',
      ) as PokemonCard[];

      if (basicInDiscard.length === 0 || player.bench.length >= 3) return state;

      const revived = basicInDiscard[0];
      const battler: Battler = {
        card: revived,
        currentHp: Math.ceil(revived.hp / 2),
        attachedEnergies: emptyEnergyZone(),
        status: 'bench',
      };

      return updatePlayer(state, playerId, {
        bench: [...player.bench, battler],
        discard: player.discard.filter((c) => c.id !== revived.id),
      });
    }

    case 'Poké Ball': {
      // Flip coin: heads = search deck for Pokemon
      const heads = Math.random() >= 0.5;
      if (!heads) {
        return {
          ...state,
          log: [...state.log, 'Poké Ball: ¡Cruz! No se encontró Pokémon.'],
        };
      }
      const pokemonInDeck = player.deck.filter((c) => isPokemonCard(c));
      if (pokemonInDeck.length === 0 || player.hand.length >= 10) return state;

      const found = pokemonInDeck[0];
      return updatePlayer(state, playerId, {
        hand: [...player.hand, found],
        deck: player.deck.filter((c) => c.id !== found.id),
      });
    }

    case 'Energy Retrieval': {
      // Get 2 basic energy from discard (simplified: just draw 2 cards from discard)
      // Since our engine doesn't have separate energy cards, we'll add 2 random energies to zone
      const randomType1 = ALL_ENERGY_TYPES[Math.floor(Math.random() * ALL_ENERGY_TYPES.length)];
      const randomType2 = ALL_ENERGY_TYPES[Math.floor(Math.random() * ALL_ENERGY_TYPES.length)];
      return updatePlayer(state, playerId, {
        energyZone: {
          ...player.energyZone,
          [randomType1]: player.energyZone[randomType1] + 1,
          [randomType2]: player.energyZone[randomType2] + 1,
        },
      });
    }

    case 'Brock':
    case 'Erika': {
      // Heal 20 HP to all your Pokemon in play
      let updatedPlayer = { ...player };
      if (updatedPlayer.activeBattler) {
        const maxHp = updatedPlayer.activeBattler.card.hp;
        updatedPlayer.activeBattler = {
          ...updatedPlayer.activeBattler,
          currentHp: Math.min(maxHp, updatedPlayer.activeBattler.currentHp + 20),
        };
      }
      updatedPlayer.bench = updatedPlayer.bench.map((b) => ({
        ...b,
        currentHp: Math.min(b.card.hp, b.currentHp + 20),
      }));

      return {
        ...state,
        players: { ...state.players, [playerId]: updatedPlayer },
      };
    }

    case 'Full Heal': {
      // Remove status effects from active Pokemon
      if (!player.activeBattler) return state;
      return updatePlayer(state, playerId, {
        activeBattler: {
          ...player.activeBattler,
          status: 'active',
        },
      });
    }

    case 'Recycle': {
      // Flip coin: heads = put 1 card from discard on top of deck
      const heads = Math.random() >= 0.5;
      if (!heads || player.discard.length === 0) {
        return {
          ...state,
          log: [...state.log, heads ? 'Recycle: No hay cartas en el descarte.' : 'Recycle: ¡Cruz! Sin efecto.'],
        };
      }
      const topDiscard = player.discard[player.discard.length - 1];
      return updatePlayer(state, playerId, {
        deck: [topDiscard, ...player.deck],
        discard: player.discard.slice(0, -1),
      });
    }

    case 'PlusPower': {
      // +10 damage on next attack — simplified: we'll log it but damage bonus is complex to track
      // For simplicity, we'll add a note in the log
      return {
        ...state,
        log: [...state.log, `${cardName}: +10 daño al próximo ataque.`],
      };
    }

    case 'Defender': {
      return {
        ...state,
        log: [...state.log, `${cardName}: -20 daño del próximo ataque rival.`],
      };
    }

    default: {
      // Unknown trainer — no game effect, just log
      return {
        ...state,
        log: [...state.log, `Se jugó ${cardName}.`],
      };
    }
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────

function updatePlayer(state: GameState, playerId: string, updates: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        ...updates,
      },
    },
  };
}

function applyHeal(
  state: GameState,
  playerId: string,
  amount: number,
  targetInfo?: { target: string; benchIndex?: number },
): GameState {
  const player = state.players[playerId];

  if (!targetInfo || targetInfo.target === 'active') {
    if (!player.activeBattler) return state;
    const maxHp = player.activeBattler.card.hp;
    return updatePlayer(state, playerId, {
      activeBattler: {
        ...player.activeBattler,
        currentHp: Math.min(maxHp, player.activeBattler.currentHp + amount),
      },
    });
  }

  if (targetInfo.target === 'bench' && targetInfo.benchIndex !== undefined) {
    const idx = targetInfo.benchIndex;
    if (idx < 0 || idx >= player.bench.length) return state;
    const battler = player.bench[idx];
    const maxHp = battler.card.hp;
    const updatedBench = player.bench.map((b, i) =>
      i === idx ? { ...b, currentHp: Math.min(maxHp, b.currentHp + amount) } : b,
    );
    return updatePlayer(state, playerId, { bench: updatedBench });
  }

  return state;
}

function discardOneEnergy(
  state: GameState,
  playerId: string,
  targetInfo?: { target: string; benchIndex?: number },
): GameState {
  const player = state.players[playerId];

  const discardFromBattler = (battler: Battler): Battler => {
    for (const type of ALL_ENERGY_TYPES) {
      if (battler.attachedEnergies[type] > 0) {
        return {
          ...battler,
          attachedEnergies: {
            ...battler.attachedEnergies,
            [type]: battler.attachedEnergies[type] - 1,
          },
        };
      }
    }
    return battler;
  };

  if (!targetInfo || targetInfo.target === 'active') {
    if (!player.activeBattler) return state;
    return updatePlayer(state, playerId, {
      activeBattler: discardFromBattler(player.activeBattler),
    });
  }

  if (targetInfo.target === 'bench' && targetInfo.benchIndex !== undefined) {
    const idx = targetInfo.benchIndex;
    if (idx < 0 || idx >= player.bench.length) return state;
    const updatedBench = player.bench.map((b, i) => (i === idx ? discardFromBattler(b) : b));
    return updatePlayer(state, playerId, { bench: updatedBench });
  }

  return state;
}
