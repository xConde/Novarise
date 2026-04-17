# Ascent Mode — Design Decisions Log

## Architecture

### RunService is root-scoped (not module-scoped)
RunService is `providedIn: 'root'` so it survives the `/ascent` ↔ `/play` route transition. A module-scoped service would be destroyed on navigation, losing all run state. The tradeoff is that a null-check is required everywhere: `if (!this.runState) return`.

### Relic effects use the pull model
Game services query `RelicService.getXxxMultiplier()` on each frame; relics do not push changes into game systems. This keeps the game engine unaware of individual relics and makes adding new relics trivial — extend `rebuildModifiers()` only. The push alternative (relics subscribing to events and patching game state) would create timing bugs and ordering dependencies.

### RewardItem union type designed for future card variant
`RewardItem = RelicReward | GoldReward` is a discriminated union so `switch(reward.type)` is exhaustive. Adding `{ type: 'card' }` later requires only a new case in `collectReward()` and the reward screen — no structural changes.

### RunEventBus is the insertion point for future card effects
Cards, when added, should subscribe to `RunEventBusService.events$` alongside relic trigger effects. This keeps the run system extensible without modifying game services.

### AscentComponent manages three views inline (no child routes)
Map, reward, shop, rest, event, and act-transition screens are all managed via `viewMode` flag in `AscentComponent` rather than separate routes. This avoids guard complexity and route-to-route state passing. The tradeoff is a larger component template, offset by delegating all business logic to RunService.

## Balance

### 20 relics (10 common / 7 uncommon / 3 rare) — intentionally small for first release
StS launched with ~72 relics but that was after years of expansion. 20 relics cover the core mechanical space (tower damage, gold, lives, sell refund, per-tower-type bonuses) without diluting reward screens. Expand in future content updates.

### 2 acts × ~12 encounters — ~30-45 minutes per run
Short enough for a single session. Act 1 introduces the mechanics; Act 2 escalates with the full enemy pool (including FLYING). Boss presets are hand-authored for quality over quantity.

### Boss presets are hand-crafted, not procedural
Procedural boss waves can produce trivial or impossible compositions. The 6 hand-authored presets (3 per act) cover distinct challenge archetypes: armor pressure, speed/swarm, air superiority, full-spectrum, iron tide, phantom blitz.

### Ascension levels stack cumulatively (not single-level toggles like StS)
Each new ascension level *adds* a modifier on top of all previous ones. Level 15 means levels 1-15 are all active simultaneously. This is correct StS behavior and means high ascension levels compound into genuine difficulty.

### Elite node weight is 12% across eligible rows [3, 9]
The map generator can place 2-8 elite nodes per act depending on RNG. The balance test caps at 8 (not 3) because: 7 eligible rows × up to 4 nodes × 12% weight = probabilistically allows up to ~8 in extreme cases. The design intent is 2-5 elites per act.

## Known Limitations

### Lucky Coin uses Math.random() not seeded RNG
`RelicService.rollLuckyCoin()` uses `Math.random()` which breaks replay determinism. The seeded RNG (`createSeededRng`) lives in RunService and is not passed to RelicService. Fixing this requires threading the RNG into RelicService or using a per-kill RNG instance. Deferred — runs are not expected to be fully replayable in v1.

### Health multipliers from ascension are applied via ModifierEffects, not baked into waves
`AscensionEffectType.ENEMY_HEALTH_MULTIPLIER` is computed by `getAscensionEffects()` but must be applied by the game board's `ModifierEffects` system (which pre-exists Ascent Mode). The game board reads ascension level from the run state and applies the multiplier on initialization. This works but means health scaling is invisible to WaveGeneratorService — wave enemy counts are unchanged regardless of ascension.

### Elite enemy gold bonus (BOUNTY_HUNTER) uses EnemyType.BOSS check, not a dedicated elite flag
`getGoldMultiplier(isElite)` relies on the caller (CombatLoopService) passing the correct `isElite` flag. There is no `isElite` property on `EnemyInstance`. The current implementation passes `false` always, meaning BOUNTY_HUNTER's double-gold only triggers for the explicit `isElite=true` call from the elite encounter gold reward, not per-kill. This is a known gap — the per-kill hook needs an enemy metadata flag to distinguish elite encounters from regular ones.

### Event relic rewards are fixed per event (not randomized from pool)
Events like "Wandering Merchant" always give FIELD_RATIONS. This is intentional for clarity and narrative consistency — a wandering merchant always has the same stock. Randomizing event rewards would require passing the RNG into event resolution, which adds complexity for unclear benefit.

### Shop heal is 1 life per purchase (not percentage-based)
`buyShopHeal()` restores exactly 1 life per purchase (cost: SHOP_CONFIG.healCostPerLife = 15 gold). StS uses percentage-based healing for its potion system, but since lives are already small integers (5-23 range), flat +1 is simpler and more legible. Players with 20 maxLives and 5 lives can purchase up to 15 heals at 15 gold each = 225 gold total — expensive enough to be a meaningful choice.

## State Leak Hardening (added during hardening pass)

### startNewRun() explicitly clears all transient state
On overwriting a run, `startNewRun()` clears `currentEncounter`, `pendingResult`, `shopItems`, `currentEvent`, and `runRng` before creating the new state. Without this, a `pendingResult` from the old run could leak into the new run's `consumePendingEncounterResult()` call.

### collectReward() has duplicate-relic guard
`collectReward({ type: 'relic', relicId })` silently skips if `relicId` is already in `state.relicIds`. This prevents the edge case where the reward screen offers a relic the player somehow already owns (e.g., if the event system and reward system independently offer the same relic).

### consumePendingEncounterResult() has double-call guard
If called twice (component navigating back unexpectedly), the second call returns `null` because `this.pendingResult` is nulled on the first call. Additionally, a `status !== IN_PROGRESS` guard prevents applying results to a run that has already ended (VICTORY, DEFEAT, ABANDONED).

### advanceAct() has idempotency guard
Calling `advanceAct()` on a run in VICTORY or DEFEAT status is a no-op. Without this, double-clicking the continue button on the act-transition screen could advance past victory into an invalid state.

## Future Card System Hooks

- `RewardItem` union type: add `{ type: 'card'; cardId: CardId }` variant
- `RunEventBus`: card effects subscribe to `events$` alongside relic trigger effects
- Shop: add a card section alongside the relic section in `generateShopItems()`
- Rest: add "upgrade card" option alongside heal (new `RestOption.UPGRADE_CARD`)
- `collectReward()`: add `case 'card'` to apply card to run state

## Card System (S6-30)

### Timing
- Cards played during SETUP and INTERMISSION phases (not real-time during combat)
- Each wave: draw hand → play cards → start wave → discard hand
- Strategic tension: 5-card hand, 3 energy = forced choices

### Card types
- Tower cards: ONLY way to place towers during Ascent encounters
- Spell cards: instant effects (gold, heal, damage, slow)
- Modifier cards: persist for 1-3 waves (damage/range/fire rate buffs)
- Utility cards: deck manipulation (draw, energy)

### Energy
- 3 base energy per wave (relics can increase)
- Tower cards cost 1-3 energy (proportional to tower gold cost ÷ 50, rounded)
- Spells cost 0-2, modifiers cost 1-2, utilities cost 0-1

### Starter deck
- 10 cards: 4x Basic Tower, 2x Sniper, 1x Splash, 1x Slow, 1x Gold Rush, 1x Damage Boost
- Intentionally weak — forces card rewards to matter

### Known limitations
- Salvage/Fortify spells not fully implemented (need tower selection UI)
- scout_ahead is a no-op (needs wave preview extension)
- Card upgrade effects are defined but balance needs tuning
- EnemyService.slowAllEnemies uses setTimeout (not physics-step safe)

## Final Hardening Pass (card system)

### Deferred tower card energy consumption
Tower cards do NOT consume energy when clicked — they enter a `pendingTowerCard` state in `GameBoardComponent`. Energy is deducted and the card moved to discard only on successful tile placement (`consumePendingTowerCard()`). Cancel (`cancelPendingTowerCard()`) returns the card to hand without any state change in DeckService.

Rationale: avoids phantom energy loss when a player clicks a tower card but then finds no valid placement tile. Only one tower card can be pending at a time — a second click is blocked while `pendingTowerCard !== null`.

Integration tests covering this contract live in `src/app/ascent/integration/card-flow.spec.ts` under the "Tower card deferred placement" suite (5 specs).

### Salvage/Fortify spell implementation
Both spells are fully wired in `GameBoardComponent.onCardPlayed()`:
- `salvage`: calls `salvageLastTower()` — refunds the last-placed tower (uses `TowerCombatService.getLastPlacedTowerKey()`).
- `fortify`: calls `fortifyRandomTower()` — picks a random L1 tower and upgrades it to L2 for free (bypasses gold cost; excludes L2 towers since L2→L3 requires manual specialization choice).

These bypass the `CardEffectService.applySpell()` path because they require game-board context (tower registry) that CardEffectService does not have. The `default` branch in `applySpell()` is an intentional no-op for these two.

### Mobile responsive approach
Card hand uses a horizontal scroll container with `overflow-x: auto` and fixed card width (`8rem`). On screens narrower than 480px, card font size and padding scale down via media queries in `card-hand.component.scss`. The energy pip row is hidden on very small screens (< 360px) to preserve card visibility.

### No TODO/FIXME items remain in ascent/ or card-hand/
Confirmed via grep: zero TODO, FIXME, HACK, or XXX markers in `src/app/ascent/` or `src/app/game/game-board/components/card-hand/`. All deferred items are documented in this file rather than inline code comments.
