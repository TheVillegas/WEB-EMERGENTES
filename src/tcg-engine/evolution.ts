import type { PokemonStage } from './types';

/**
 * Hardcoded Gen1 evolution chains.
 * Key = evolved form, Value = pre-evolution name.
 */
const EVOLUTION_MAP: Record<string, { from: string; stage: PokemonStage }> = {
  // Fire
  'Charmeleon': { from: 'Charmander', stage: 'stage1' },
  'Charizard': { from: 'Charmeleon', stage: 'stage2' },
  'Ninetales': { from: 'Vulpix', stage: 'stage1' },
  'Arcanine': { from: 'Growlithe', stage: 'stage1' },
  'Rapidash': { from: 'Ponyta', stage: 'stage1' },
  'Magmar': { from: 'Magmar', stage: 'basic' }, // Magmar is basic in Gen1
  'Flareon': { from: 'Eevee', stage: 'stage1' },

  // Water
  'Wartortle': { from: 'Squirtle', stage: 'stage1' },
  'Blastoise': { from: 'Wartortle', stage: 'stage2' },
  'Dewgong': { from: 'Seel', stage: 'stage1' },
  'Golduck': { from: 'Psyduck', stage: 'stage1' },
  'Starmie': { from: 'Staryu', stage: 'stage1' },
  'Cloyster': { from: 'Shellder', stage: 'stage1' },
  'Poliwrath': { from: 'Poliwhirl', stage: 'stage2' },
  'Poliwhirl': { from: 'Poliwag', stage: 'stage1' },
  'Seadra': { from: 'Horsea', stage: 'stage1' },
  'Gyarados': { from: 'Magikarp', stage: 'stage1' },
  'Vaporeon': { from: 'Eevee', stage: 'stage1' },
  'Tentacruel': { from: 'Tentacool', stage: 'stage1' },

  // Grass
  'Ivysaur': { from: 'Bulbasaur', stage: 'stage1' },
  'Venusaur': { from: 'Ivysaur', stage: 'stage2' },
  'Gloom': { from: 'Oddish', stage: 'stage1' },
  'Vileplume': { from: 'Gloom', stage: 'stage2' },
  'Victreebel': { from: 'Weepinbell', stage: 'stage2' },
  'Weepinbell': { from: 'Bellsprout', stage: 'stage1' },
  'Parasect': { from: 'Paras', stage: 'stage1' },
  'Venomoth': { from: 'Venonat', stage: 'stage1' },
  'Exeggutor': { from: 'Exeggcute', stage: 'stage1' },

  // Lightning
  'Raichu': { from: 'Pikachu', stage: 'stage1' },
  'Electrode': { from: 'Voltorb', stage: 'stage1' },
  'Magneton': { from: 'Magnemite', stage: 'stage1' },
  'Jolteon': { from: 'Eevee', stage: 'stage1' },

  // Psychic
  'Kadabra': { from: 'Abra', stage: 'stage1' },
  'Alakazam': { from: 'Kadabra', stage: 'stage2' },
  'Haunter': { from: 'Gastly', stage: 'stage1' },
  'Gengar': { from: 'Haunter', stage: 'stage2' },
  'Hypno': { from: 'Drowzee', stage: 'stage1' },
  'Slowbro': { from: 'Slowpoke', stage: 'stage1' },
  'Mr. Mime': { from: 'Mr. Mime', stage: 'basic' },

  // Fighting
  'Machoke': { from: 'Machop', stage: 'stage1' },
  'Machamp': { from: 'Machoke', stage: 'stage2' },
  'Graveler': { from: 'Geodude', stage: 'stage1' },
  'Golem': { from: 'Graveler', stage: 'stage2' },
  'Primeape': { from: 'Mankey', stage: 'stage1' },
  'Marowak': { from: 'Cubone', stage: 'stage1' },
  'Poliwrath_F': { from: 'Poliwhirl', stage: 'stage2' }, // Poliwrath is also Fighting

  // Colorless / Normal
  'Pidgeotto': { from: 'Pidgey', stage: 'stage1' },
  'Pidgeot': { from: 'Pidgeotto', stage: 'stage2' },
  'Raticate': { from: 'Rattata', stage: 'stage1' },
  'Wigglytuff': { from: 'Jigglypuff', stage: 'stage1' },
  'Persian': { from: 'Meowth', stage: 'stage1' },
  'Dodrio': { from: 'Doduo', stage: 'stage1' },
  'Fearow': { from: 'Spearow', stage: 'stage1' },
  'Clefable': { from: 'Clefairy', stage: 'stage1' },

  // Dragon / Others
  'Dragonair': { from: 'Dratini', stage: 'stage1' },
  'Dragonite': { from: 'Dragonair', stage: 'stage2' },
  'Nidorina': { from: 'Nidoran♀', stage: 'stage1' },
  'Nidoqueen': { from: 'Nidorina', stage: 'stage2' },
  'Nidorino': { from: 'Nidoran♂', stage: 'stage1' },
  'Nidoking': { from: 'Nidorino', stage: 'stage2' },

  // Blaine's / Gym variants — use base name matching
  "Blaine's Charmeleon": { from: "Blaine's Charmander", stage: 'stage1' },
  "Blaine's Charizard": { from: "Blaine's Charmeleon", stage: 'stage2' },
  "Blaine's Arcanine": { from: "Blaine's Growlithe", stage: 'stage1' },
  "Blaine's Ninetales": { from: "Blaine's Vulpix", stage: 'stage1' },
  "Blaine's Rapidash": { from: "Blaine's Ponyta", stage: 'stage1' },
  "Misty's Golduck": { from: "Misty's Psyduck", stage: 'stage1' },
  "Misty's Starmie": { from: "Misty's Staryu", stage: 'stage1' },
  "Misty's Dewgong": { from: "Misty's Seel", stage: 'stage1' },
  "Misty's Cloyster": { from: "Misty's Shellder", stage: 'stage1' },
  "Misty's Tentacruel": { from: "Misty's Tentacool", stage: 'stage1' },
  "Misty's Gyarados": { from: "Misty's Magikarp", stage: 'stage1' },
  "Erika's Vileplume": { from: "Erika's Gloom", stage: 'stage2' },
  "Erika's Gloom": { from: "Erika's Oddish", stage: 'stage1' },
  "Erika's Victreebel": { from: "Erika's Weepinbell", stage: 'stage2' },
  "Erika's Weepinbell": { from: "Erika's Bellsprout", stage: 'stage1' },
  "Lt. Surge's Raichu": { from: "Lt. Surge's Pikachu", stage: 'stage1' },
  "Lt. Surge's Electrode": { from: "Lt. Surge's Voltorb", stage: 'stage1' },
  "Lt. Surge's Magneton": { from: "Lt. Surge's Magnemite", stage: 'stage1' },
  "Sabrina's Kadabra": { from: "Sabrina's Abra", stage: 'stage1' },
  "Sabrina's Alakazam": { from: "Sabrina's Kadabra", stage: 'stage2' },
  "Sabrina's Gengar": { from: "Sabrina's Haunter", stage: 'stage2' },
  "Sabrina's Haunter": { from: "Sabrina's Gastly", stage: 'stage1' },
  "Sabrina's Hypno": { from: "Sabrina's Drowzee", stage: 'stage1' },
  "Brock's Graveler": { from: "Brock's Geodude", stage: 'stage1' },
  "Brock's Golem": { from: "Brock's Graveler", stage: 'stage2' },
  "Brock's Primeape": { from: "Brock's Mankey", stage: 'stage1' },
  "Dark Charmeleon": { from: "Charmander", stage: 'stage1' },
  "Dark Charizard": { from: "Dark Charmeleon", stage: 'stage2' },
  "Dark Blastoise": { from: "Dark Wartortle", stage: 'stage2' },
  "Dark Wartortle": { from: "Squirtle", stage: 'stage1' },
  "Dark Vileplume": { from: "Dark Gloom", stage: 'stage2' },
  "Dark Gloom": { from: "Oddish", stage: 'stage1' },
  "Dark Machoke": { from: "Machop", stage: 'stage1' },
  "Dark Machamp": { from: "Dark Machoke", stage: 'stage2' },
  "Dark Alakazam": { from: "Dark Kadabra", stage: 'stage2' },
  "Dark Kadabra": { from: "Abra", stage: 'stage1' },
  "Dark Golduck": { from: "Psyduck", stage: 'stage1' },
  "Dark Hypno": { from: "Drowzee", stage: 'stage1' },
  "Dark Slowbro": { from: "Slowpoke", stage: 'stage1' },
  "Dark Rapidash": { from: "Ponyta", stage: 'stage1' },
  "Dark Arbok": { from: "Ekans", stage: 'stage1' },
  "Dark Weezing": { from: "Koffing", stage: 'stage1' },
  "Dark Magneton": { from: "Magnemite", stage: 'stage1' },
  "Dark Electrode": { from: "Voltorb", stage: 'stage1' },
  "Dark Gyarados": { from: "Magikarp", stage: 'stage1' },
  "Dark Dragonite": { from: "Dark Dragonair", stage: 'stage2' },
  "Dark Dragonair": { from: "Dratini", stage: 'stage1' },
};

/**
 * Get the evolution stage of a card by name.
 * If not found in the map, returns 'basic'.
 */
export function getEvolutionStage(name: string): PokemonStage {
  const entry = EVOLUTION_MAP[name];
  if (entry) return entry.stage;
  return 'basic';
}

/**
 * Get the pre-evolution name for a card.
 * Returns null if the card is basic.
 */
export function getEvolvesFrom(name: string): string | null {
  const entry = EVOLUTION_MAP[name];
  if (entry && entry.stage !== 'basic') return entry.from;
  return null;
}

/**
 * Check if a card can evolve into another.
 * @param basicName The name of the basic/pre-evolution Pokémon
 * @param evolutionName The name of the evolution Pokémon
 */
export function canEvolveInto(basicName: string, evolutionName: string): boolean {
  const entry = EVOLUTION_MAP[evolutionName];
  if (!entry) return false;
  return entry.from === basicName;
}

/**
 * Get all possible evolutions for a given Pokémon name.
 */
export function getEvolutions(name: string): string[] {
  const evolutions: string[] = [];
  for (const [evolvedName, entry] of Object.entries(EVOLUTION_MAP)) {
    if (entry.from === name) {
      evolutions.push(evolvedName);
    }
  }
  return evolutions;
}
