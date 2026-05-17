import { describe, expect, it } from 'vitest';
import { normalizeCatalog, parseCatalogCsv, selectStarterCards } from './cardRepository';

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
