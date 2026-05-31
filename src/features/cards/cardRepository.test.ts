import { describe, expect, it } from 'vitest';
import { normalizeCatalog, parseCatalogCsv, selectStarterCards, toTcgCard } from './cardRepository';
import type { CsvCardRow } from './types';

const sampleCsv = `nombre,categoria,tipo,hp,ataque_1_nombre,ataque_1_dano,ataque_1_costo,imagen_small,imagen_large
Bill,Entrenador,,,,,,https://example.com/bill-small.png,https://example.com/bill-large.png
Bulbasaur,Pokémon,Grass,40,Leech Seed,20,"Grass, Grass",https://example.com/bulbasaur-small.png,https://example.com/bulbasaur-large.png
Ditto,Pokémon,Colorless,50,,,,https://example.com/ditto-small.png,
Charmander,Pokémon,Fire,50,Scratch,10,Colorless,https://example.com/charmander-small.png,https://example.com/charmander-large.png`;

describe('cardRepository', () => {
  it('filters only Pokémon rows and preserves simplified battle fields', () => {
    const rows = parseCatalogCsv(sampleCsv);
    const cards = normalizeCatalog(rows);

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.name)).toEqual(['Bulbasaur', 'Ditto', 'Charmander']);
    expect(cards[0]).toMatchObject({
      category: 'Pokémon',
      type: 'Grass',
      hp: 40,
      attackName: 'Leech Seed',
      attackDamage: 20,
      attackCost: 2,
    });
  });

  it('returns safe fallbacks when optional display fields are missing', () => {
    const rows = parseCatalogCsv(sampleCsv);
    const cards = normalizeCatalog(rows);
    const ditto = cards[1];

    expect(ditto.attackName).toBe('Golpe básico');
    expect(ditto.attackDamage).toBe(0);
    expect(ditto.attackCost).toBe(0);
    expect(ditto.imageLarge).toBe('https://example.com/ditto-small.png');
  });

  it('selects a deterministic starter hand from the catalog', () => {
    const rows = parseCatalogCsv(sampleCsv);
    const cards = normalizeCatalog(rows);

    expect(selectStarterCards(cards, 2).map((card) => card.name)).toEqual(['Bulbasaur', 'Ditto']);
  });
});

describe('toTcgCard', () => {
  it('converts a Pokemon row with one attack', () => {
    const row: CsvCardRow = {
      nombre: 'Bulbasaur',
      categoria: 'Pokémon',
      tipo: 'Grass',
      hp: '40',
      debilidad: 'Fire ×2',
      ataque_1_nombre: 'Leech Seed',
      ataque_1_dano: '20',
      ataque_1_costo: 'Grass, Grass',
      ataque_1_efecto: 'Heal 10',
      imagen_small: 'small.png',
      imagen_large: 'large.png',
    };

    const cards = toTcgCard([row], 0);
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect('types' in card).toBe(true);
    if ('types' in card) {
      expect(card.name).toBe('Bulbasaur');
      expect(card.types).toEqual(['grass']);
      expect(card.hp).toBe(40);
      expect(card.weakness).toBe('fire');
      expect(card.retreatCost).toBe(1);
      expect(card.attacks).toHaveLength(1);
      expect(card.attacks[0]).toMatchObject({
        name: 'Leech Seed',
        damage: 20,
        cost: ['grass', 'grass'],
        effect: 'Heal 10',
      });
    }
  });

  it('converts a Pokemon row with two attacks', () => {
    const row: CsvCardRow = {
      nombre: 'Charizard',
      categoria: 'Pokémon',
      tipo: 'Fire',
      hp: '120',
      debilidad: 'Water ×2',
      ataque_1_nombre: 'Flamethrower',
      ataque_1_dano: '50',
      ataque_1_costo: 'Fire, Fire, Colorless',
      ataque_2_nombre: 'Fire Spin',
      ataque_2_dano: '100',
      ataque_2_costo: 'Fire, Fire, Fire, Colorless',
      imagen_small: 'small.png',
      imagen_large: 'large.png',
    };

    const cards = toTcgCard([row], 0);
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect('types' in card).toBe(true);
    if ('types' in card) {
      expect(card.attacks).toHaveLength(2);
      expect(card.attacks[1].name).toBe('Fire Spin');
      expect(card.attacks[1].cost).toEqual(['fire', 'fire', 'fire', 'colorless']);
    }
  });

  it('converts a Trainer row to an Item card', () => {
    const row: CsvCardRow = {
      nombre: 'Potion',
      categoria: 'Entrenador',
      tipo: 'Item',
      hp: '',
      ataque_1_nombre: '',
      imagen_small: 'small.png',
      imagen_large: 'large.png',
    };

    const cards = toTcgCard([row], 0);
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect('type' in card).toBe(true);
    if ('type' in card) {
      expect(card.name).toBe('Potion');
      expect(card.type).toBe('item');
    }
  });

  it('parses weakness from "Type ×2" format', () => {
    const row: CsvCardRow = {
      nombre: 'Pikachu',
      categoria: 'Pokémon',
      tipo: 'Lightning',
      hp: '40',
      debilidad: 'Fighting ×2',
      ataque_1_nombre: 'Thunder Shock',
      ataque_1_dano: '30',
      ataque_1_costo: 'Lightning',
      imagen_small: 'small.png',
      imagen_large: 'large.png',
    };

    const cards = toTcgCard([row], 0);
    const card = cards[0];
    expect('types' in card).toBe(true);
    if ('types' in card) {
      expect(card.weakness).toBe('fighting');
    }
  });

  it('handles missing optional fields with defaults', () => {
    const row: CsvCardRow = {
      nombre: 'Missing',
      categoria: 'Pokémon',
      tipo: 'Grass',
      hp: '',
      ataque_1_nombre: '',
      imagen_small: 'small.png',
      imagen_large: 'large.png',
    };

    const cards = toTcgCard([row], 0);
    const card = cards[0];
    expect('types' in card).toBe(true);
    if ('types' in card) {
      expect(card.hp).toBe(0);
      expect(card.attacks).toHaveLength(0);
      expect(card.weakness).toBeNull();
      expect(card.retreatCost).toBe(1);
    }
  });

  it('converts mixed Pokemon and Trainer rows', () => {
    const rows: CsvCardRow[] = [
      { nombre: 'Bulbasaur', categoria: 'Pokémon', tipo: 'Grass', hp: '40', ataque_1_nombre: 'Tackle', ataque_1_dano: '10', ataque_1_costo: 'Grass' },
      { nombre: 'Bill', categoria: 'Entrenador' },
    ];

    const cards = toTcgCard(rows);
    expect(cards).toHaveLength(2);
    expect('types' in cards[0]).toBe(true);
    expect('type' in cards[1]).toBe(true);
  });
});
