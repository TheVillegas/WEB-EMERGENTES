# Pokémon Web Demo

Slice 3 del apply SDD: board Phaser 3 en modo read-only, React + Zustand como shell principal, y adapter HTTP opcional para el NPC con fallback robusto al mock local.

## Correr localmente

```bash
npm install
npm run dev
```

Abrí la URL **HTTP** que muestre Vite (por ejemplo `http://localhost:5173`). En `localhost` el navegador no debería mostrar advertencias de certificado.

### Si ves «La conexión no es privada» (`ERR_CERT_AUTHORITY_INVALID`)

Eso pasa cuando usás **HTTPS con certificado autofirmado** (`npm run dev:https`). El servidor de desarrollo no usa un certificado de una autoridad pública; es normal en local.

**Opción A (recomendada para jugar en PC):** usá HTTP sin certificado:

```bash
npm run dev
```

y entrá a `http://localhost:5173`.

**Opción B (si necesitás HTTPS, p. ej. AR desde el celular en la red local):**

```bash
npm run dev:https
```

En Chrome/Edge: **Avanzado** → **Continuar a localhost (no seguro)**. En el celular el aviso es similar; solo aceptalo si confiás en tu propia red de desarrollo.

**Opción C:** instalá [mkcert](https://github.com/FiloSottile/mkcert) y generá un certificado de confianza local (avanzado).

## Modo AR (WebXR)

La demo incluye un modo alternativo con **React Three Fiber + WebXR**:

1. Cargá el catálogo y tocá **Modo AR** en la pantalla principal.
2. En móvil compatible (p. ej. Chrome en Android), tocá **Iniciar AR** y permití la cámara.
3. Tocá **Colocar mesa** apuntando a una superficie plana.
4. Jugá con el HUD inferior (misma lógica que la vista clásica).

Reglas visuales en AR:

- **Jugador**: mano y Pokémon activo con la cara de la carta.
- **Rival**: mano con reverso (`public/assets/card-back.svg`); Pokémon activo con cara visible (estilo TCG).

Si tu dispositivo no soporta `immersive-ar`, usá **Vista previa 3D** para ver la mesa sin cámara (útil en desktop).

Limitaciones conocidas:

- WebAR en **móvil por IP de red** suele requerir **HTTPS** → usá `npm run dev:https` y aceptá el certificado local, o la **Vista previa 3D** en desktop con `npm run dev`.
- En `http://localhost` muchas funciones (vista clásica y preview 3D) funcionan sin HTTPS.
- iOS Safari tiene soporte WebXR limitado; priorizá Android/Chrome para AR completo.

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
- `src/features/ar/mapMatchToArScene.test.ts` verifica cara/reverso por zona en la escena AR.

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
- modo AR WebXR alternable con vista clásica (Phaser + HUD 2D)
