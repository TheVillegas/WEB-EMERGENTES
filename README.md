# Pokémon Web Demo

Slice 3 del apply SDD: board Phaser 3 en modo read-only, React + Zustand como shell principal, y adapter HTTP opcional para el NPC con fallback robusto al mock local.

## Correr localmente

```bash
npm install
npm run dev
```

Abrí la URL que te muestre Vite, elegí tu carta activa, asigná energía, atacá o pasá turno.

## Backend opcional del NPC

La demo arranca SEGURA en offline. Si no configurás nada, usa mock local.

```bash
# camino seguro por defecto
npm run dev

# modo HTTP opcional
VITE_NPC_MODE=http \
VITE_NPC_ENDPOINT=http://127.0.0.1:8000/decide-action \
npm run dev
```

Si tu backend real sólo expone `POST /batalla/accion`, el store no cambia. Configurá el adapter así:

```bash
VITE_NPC_MODE=http \
VITE_NPC_ENDPOINT=http://127.0.0.1:8000/batalla/accion \
VITE_NPC_CONTRACT=legacy-batalla-accion \
npm run dev
```

Variables soportadas:

- `VITE_NPC_MODE=mock|http` → default `mock`
- `VITE_NPC_ENDPOINT` → default `/decide-action`
- `VITE_NPC_TIMEOUT_MS` → default `1500`
- `VITE_NPC_CONTRACT=simple|legacy-batalla-accion`

Si el backend tarda demasiado, devuelve JSON inválido o no está levantado, el turno del NPC cae al mock local y la bitácora deja un aviso no bloqueante.

## Tests

```bash
npm test
```

Cobertura relevante de este slice:

- `src/features/npc/httpNpcService.test.ts` verifica contrato simple, fallback y adapter legacy.
- `src/features/battle/store.test.ts` verifica que el aviso de fallback llegue al log sin romper el loop.

## Dataset

El catálogo local vive en `public/data/pokemon_cards_gen1.csv` y se filtra por `categoria = Pokémon`.

## Loop offline implementado

- selección de carta activa desde la mano del jugador
- carta activa inicial del NPC con turno local offline
- energía como contador simple
- ataque directo al HP rival
- mesa Phaser 3 sincronizada en modo solo lectura con HP, energía, turno y feedback de daño
- adapter HTTP opcional encapsulado detrás de `httpNpcService.ts`
- victoria/derrota cuando el HP activo llega a `0`
- reinicio completo de partida con battle log limpio
