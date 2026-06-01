# Delta Spec: battle-turn-actions

## ADDED Requirements

### 1. Energy System (`energy-zone`)
The system MUST manage a per-player `EnergyZone` and track energy attachments per Pokemon.
The system MUST generate 1 random basic energy (out of 10 types) per turn.
A player MAY attach 1 energy from the zone to any Pokemon (active or bench) once per turn.
Energy MUST persist through switching but MUST be discarded on KO.

#### Scenario: Normal attachment
- GIVEN energy in zone and no prior attachments
- WHEN player attaches to active or bench Pokemon
- THEN energy moves to Pokemon AND attachment limit is consumed for the turn

#### Scenario: KO discards energy
- GIVEN a Pokemon with attached energy
- WHEN the Pokemon is KO'd
- THEN all attached energy is discarded

### 2. Bench & Switching (`bench-mechanics`)
The system MUST allow 1 active and up to 3 bench Pokemon.
A player MAY switch the active Pokemon by paying its retreat cost from attached energy.
The system MUST force a switch to a bench Pokemon if the active is KO'd.
The system MUST declare a loss if a player has no bench Pokemon to replace a KO'd active.

#### Scenario: Switch active
- GIVEN active Pokemon has attached energy >= retreat cost
- WHEN player switches to bench Pokemon
- THEN energy equal to retreat cost is discarded AND Pokemon are swapped

#### Scenario: Loss on empty bench
- GIVEN a player has an empty bench
- WHEN their active Pokemon is KO'd
- THEN the player loses the game

### 3. Points & Victory (`points-victory`)
The system MUST award 1 point for a basic KO and 2 points for an EX KO.
The system MUST declare victory when a player reaches 3 or more points.

#### Scenario: Gain points and win
- GIVEN a player has 2 points
- WHEN they KO an opponent's EX Pokemon
- THEN they gain 2 points (total 4) AND win the game

### 4. Multi-Attack (`multi-attack`)
The system MUST validate attack costs against attached energy types (Colorless matches any).
The system MUST apply +20 damage if the defending Pokemon's weakness matches the attack type.

#### Scenario: Valid attack with weakness
- GIVEN active Pokemon has required energy AND defending Pokemon is weak to it
- WHEN player attacks
- THEN attack succeeds AND damage is increased by 20

#### Scenario: Insufficient energy
- GIVEN active Pokemon lacks required energy
- WHEN player attempts to attack
- THEN the attack fails and is rejected

### 5. Turn Flow (`turn-phases`)
The system MUST enforce a turn structure: draw, main phase (attach, attack, switch, items, supporter), end.
The system MUST limit supporters to 1 per turn, and items to unlimited.
The system MUST skip card draw and energy attachment on the very first turn of the game.

#### Scenario: First turn restrictions
- GIVEN it is the first turn of the game
- WHEN the turn starts
- THEN no card is drawn AND no energy is generated/attached

#### Scenario: Item vs Supporter limits
- GIVEN player has played 1 supporter and 1 item this turn
- WHEN they attempt to play another item
- THEN item succeeds
- AND WHEN they attempt to play another supporter
- THEN supporter is rejected

### 6. Trainer Cards (`trainer-cards`)
The system MUST enforce a 10-card hand limit (excess cards cannot be drawn).
The system MUST move played trainer cards to the discard pile.

#### Scenario: Hand limit
- GIVEN a player has 10 cards in hand
- WHEN a turn draw phase occurs
- THEN no card is drawn

### 7. State Factory (`state-init`)
The system MUST initialize a GameState with 5 opening hand cards, 0 energy, 1 active Pokemon, empty bench, and 20 card deck.

#### Scenario: Initialize Game
- GIVEN a valid 20-card deck and player ID
- WHEN createInitialState is called
- THEN GameState is returned with 5 cards in hand AND first Pokemon as active
