export type EnergyType =
  | 'grass'
  | 'fire'
  | 'water'
  | 'lightning'
  | 'psychic'
  | 'fighting'
  | 'darkness'
  | 'metal'
  | 'dragon'
  | 'colorless';

export const ALL_ENERGY_TYPES: EnergyType[] = [
  'grass',
  'fire',
  'water',
  'lightning',
  'psychic',
  'fighting',
  'darkness',
  'metal',
  'dragon',
  'colorless',
];

export interface Attack {
  name: string;
  damage: number;
  cost: EnergyType[];
  effect: string;
}

export type PokemonStage = 'basic' | 'stage1' | 'stage2';

export interface PokemonCard {
  id: string;
  name: string;
  types: EnergyType[];
  hp: number;
  attacks: Attack[];
  weakness: EnergyType | null;
  retreatCost: number;
  isEx: boolean;
  stage: PokemonStage;
  evolvesFrom: string | null;
  imageSmall: string;
  imageLarge: string;
}

export interface TrainerCard {
  id: string;
  name: string;
  type: 'item' | 'supporter' | 'stadium';
  effect: string;
  imageSmall: string;
  imageLarge: string;
}

export type TcgCard = PokemonCard | TrainerCard;

export interface Battler {
  card: PokemonCard;
  currentHp: number;
  attachedEnergies: Record<EnergyType, number>;
  status: 'active' | 'bench';
}

export type EnergyZone = Record<EnergyType, number>;

export interface PlayerState {
  hand: TcgCard[];
  deck: TcgCard[];
  discard: TcgCard[];
  bench: Battler[];
  energyZone: EnergyZone;
  points: number;
  activeBattler: Battler | null;
  hasAttachedEnergy: boolean;
  hasUsedSupporter: boolean;
  hasEvolved: boolean;
  hasRetreated: boolean;
}

export type TurnPhase = 'draw' | 'main' | 'attack' | 'end';

export type GamePhase = 'setup' | 'battle' | 'ended';

export interface GameState {
  players: Record<string, PlayerState>;
  currentTurn: string;
  turnPhase: TurnPhase;
  turnNumber: number;
  winner: string | null;
  turnOrder: string[];
  log: string[];
  gamePhase: GamePhase;
  diceRoll: number | null;
}

export interface ActionResult {
  success: boolean;
  state: GameState | null;
  error: string | null;
}

export type EngineError =
  | 'CantRetreatError'
  | 'NotEnoughEnergyError'
  | 'NoBenchPokemonError'
  | 'EnergyAlreadyAttachedError'
  | 'WrongPhaseError'
  | 'NotYourTurnError'
  | 'HandFullError'
  | 'NoActivePokemonError'
  | 'InvalidBenchIndexError'
  | 'InvalidAttackIndexError'
  | 'NotATrainerError'
  | 'GameOverError';
