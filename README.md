# Pokémon Web Demo

Slice 2 del apply SDD: demo offline jugable con motor puro, Zustand, NPC local determinístico y battle log.

## Correr localmente

```bash
npm install
npm run dev
```

Abrí la URL que te muestre Vite, elegí tu carta activa, asigná energía, atacá o pasá turno.

## Tests

```bash
npm test
```

## Dataset

El catálogo local vive en `public/data/pokemon_cards_gen1.csv` y se filtra por `categoria = Pokémon`.

## Loop offline implementado

- selección de carta activa desde la mano del jugador
- carta activa inicial del NPC con turno local offline
- energía como contador simple
- ataque directo al HP rival
- victoria/derrota cuando el HP activo llega a `0`
- reinicio completo de partida con battle log limpio
