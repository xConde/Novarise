# Architecture — Novarise

Card-driven turn-based tower-defense roguelite. Every combat encounter runs
inside a Run — no standalone TD mode.

## Routes

All lazy-loaded. `gameLeaveGuard` is a functional `CanDeactivateFn` on `/play`.
`devLibraryGuard` redirects `/library` → `/` when `environment.enableDevTools`
is false.

| Route | Module | Responsibility |
|-------|--------|----------------|
| `/` | `LandingModule` | Start / resume / editor entry point |
| `/edit` | `EditorModule` (`games/novarise/`) | Map editor |
| `/run` | `RunModule` | Run hub — node map, shop, reward, rest, event, summary |
| `/play` | `GameModule` | Combat encounter view |
| `/profile` | `ProfileModule` | Stats + achievements |
| `/settings` | `SettingsModule` | Settings modal |
| `/library` | `LibraryModule` | Codex (dev-gated) |

Fallback `**` → `/`.

## Directory Map

```
src/
├── app/
│   ├── core/                          # App-wide singletons (root-scoped via providedIn: 'root')
│   │   ├── services/                  # map-bridge, map-storage, map-template, player-profile,
│   │   │                              #   seen-cards, settings, storage, tutorial, error-handler
│   │   ├── guards/                    # dev-library.guard
│   │   └── models/                    # map-schema, map-template
│   ├── game/                          # /play combat encounter
│   │   ├── game-board/
│   │   │   ├── components/            # pile-inspector, last-turn-summary, game-hud,
│   │   │   │                          #   tower-info-panel, card-hand, card-detail, ...
│   │   │   ├── constants/             # 20+ config files (see Constants Architecture)
│   │   │   ├── models/                # tower, enemy, wave, game-state, score, modifier,
│   │   │   │                          #   encounter-checkpoint (v10), game-board-tile, …
│   │   │   ├── services/              # 55+ component-scoped services
│   │   │   ├── testing/               # Shared factories: test-board, test-enemy, test-spies barrel;
│   │   │   │                          #   spies/ split — tower, enemy-combat, run-card, session-state,
│   │   │   │                          #   platform (5 concern files)
│   │   │   └── utils/                 # coordinate-utils (dist2d, isInBounds, shuffleInPlace, gridToWorld,
│   │   │                              #   worldToGrid), three-utils (disposeMesh/Group, getMaterials),
│   │   │                              #   min-heap, object-pool, spatial-grid, ...
│   │   ├── guards/                    # game-leave.guard
│   │   ├── game-board.component.ts    # Encounter coordinator (~1500 LOC after 6-cluster decomp)
│   │   └── game-board.service.ts      # Board generation, tile mutation API
│   ├── games/novarise/                # /edit map editor
│   │   ├── constants/                 # editor-camera, editor-scene, editor-ui
│   │   ├── core/                      # Editor-scoped services (index.ts barrel)
│   │   ├── features/                  # mobile-controls, terrain-editor, ui-controls
│   │   └── novarise.component.ts      # Editor renderer (~780 LOC)
│   ├── library/                       # /library Codex (dev-gated)
│   │   ├── components/                # library-filters, library-card-tile, card-detail-modal
│   │   └── card-library.component.ts  # Codex page
│   ├── run/                           # /run hub + run lifecycle
│   │   ├── components/                # event-screen, reward-screen, shop-screen, rest-screen,
│   │   │                              #   node-map, card-draft, run-summary, act-transition, …
│   │   ├── constants/                 # card-definitions, run-events, modifier-stat, flag-keys, ...
│   │   ├── models/                    # card, card-instance, run-state, node-map, relic, event
│   │   ├── services/                  # 14 root-scoped services (see Run Subsystem)
│   │   └── integration/               # cross-service round-trip specs (cartographer, highground,
│   │                                  #   conduit, run-flow, card-flow, card-balance)
│   ├── landing/                       # / landing page
│   ├── profile/                       # /profile
│   ├── settings/                      # /settings modal
│   └── shared/                        # focus-trap util, icon component
└── styles/                            # SCSS partials
    ├── _variables.scss                # :root custom properties
    ├── _base.scss                     # Reset, body, scrollbars, focus-visible
    ├── _animations.scss               # @keyframes
    └── ... game / editor / page partials
```

## Module Boundaries

**`RunModule` (`/run`)** — no services; all run services are `providedIn: 'root'`
so they survive `/run` ↔ `/play` transitions. See Run Subsystem.

**`GameModule` (`/play`)** provides:
`GameBoardService`, `PathMutationService`, `ElevationService`, `LineOfSightService`,
`TerraformMaterialPoolService`.

**`GameBoardComponent`** component-scoped providers (~55): `SceneService`,
`EnemyService`, `TowerCombatService`, `CombatLoopService`, `WaveService`,
`CardPlayService`, `TowerGraphService`, `LinkMeshService`, `StatusEffectService`,
`BoardMeshRegistryService`, `TowerMeshLifecycleService`, `TowerPlacementService`,
`TowerSelectionService`, `TurnHistoryService`, `WaveCombatFacadeService`,
`TutorialFacadeService`, plus the 6 services landed by the post-pivot
decomposition pass: `TurnBannerService`, `PathBlockedWarningService`,
`ItemCallbacksWiringService`, `SpawnPreviewViewService`,
`EncounterBootstrapService`, `CheckpointRestoreCoordinatorService` —
and the mesh / visual / audio / particle services.

**`EditorModule` (`/edit`)** provides the editor-scoped service graph under
`games/novarise/core/`.

**`LibraryModule` (`/library`)** provides: `LibraryFiltersComponent`,
`LibraryCardTileComponent`, `CardDetailModalComponent` + the Codex page itself.

**Root-scoped services (survive all route transitions):**
- `core/services/*` — `MapBridgeService`, `SettingsService`, `PlayerProfileService`,
  `MapStorageService`, `MapTemplateService`, `StorageService`, `TutorialService`,
  `SeenCardsService`
- `run/services/*` — all 14 run services (see below)
- `EncounterCheckpointService` (root, used by run + game)

## Run Subsystem (`src/app/run/services/`)

All 14 services are `providedIn: 'root'`. They survive route transitions so
run state is preserved across `/run` ↔ `/play`. Explicit `reset()` on run end
or new-run start (see red-team lessons below).

| Service | Responsibility |
|---------|----------------|
| `RunService` | Central run orchestrator; `runState$` + `nodeMap$` BehaviorSubjects; start / encounter / reward / advance / end lifecycle; seeded run RNG via `createSeededRng(seed)` |
| `DeckService` | 4-pile deck model (draw / hand / discard / exhaust); energy state; card play / draw / discard / exhaust / upgrade; archetype dominance query (`getDominantArchetype`) |
| `CardEffectService` | Spell / modifier card effect resolution; active modifier list with wave- OR turn-countdown; `tickWave()` / `tickTurn()`; `tryConsumeLeakBlock()`, `tryConsumeTerraformRefund()`, `getMaxModifierEntryValue()` |
| `RelicService` | Pull-model relic effects; cached `RelicModifiers` rebuilt on relic set change; trigger-based relics (`ARCHITECTS_BLUEPRINT`, `LUCKY_COIN`, `TUNING_FORK`, etc.) |
| `EncounterService` | Node → `EncounterConfig`; loads map into `MapBridgeService` before `/play` navigation |
| `EncounterCheckpointService` | Mid-encounter save/resume; localStorage persistence; version migration chain v1 → v10; corrupt-checkpoint detection |
| `NodeMapGeneratorService` | Seeded node graph (mulberry32 RNG); 11 content rows + boss row; SHOP row 5, REST row 8 |
| `WaveGeneratorService` | Procedural wave composition; depth-tiered pools; elite / boss presets |
| `ItemService` | Consumable item inventory (HEAL, ENERGY_ELIXIR, …); phase-gated use |
| `RunStateFlagService` | Per-run state flags (e.g., `MERCHANT_AIDED`); consumed one-shot event triggers |
| `RunMapService` | `/run` → `/play` navigation bridge; preserves currentNodeId |
| `RunEventBusService` | Pub-sub `Subject<RunEvent>` for cross-service events |
| `RunPersistenceService` | localStorage run save/resume; keys: `novarise_run_state`, `novarise_run_map` |
| `AscensionModifierService` | Ascension-level modifiers applied to encounter config (enemy HP, shop prices, starting relic downgrade, anti-heal, …) |

## Save / Resume Architecture

**Checkpoint current version:** 10 (declared in `game-board/models/encounter-checkpoint.model.ts`).

**Auto-save:** Hook in `WaveCombatFacadeService.endTurn()` — saves after every
`resolveTurn()`, clears on VICTORY / DEFEAT.

**Manual save:** Pause menu "Save & Exit" → `CanDeactivate` observable → user
confirmation → `EncounterCheckpointService.saveCheckpoint()`.

**Restore flow** (in `CheckpointRestoreCoordinatorService.restore`, 18 steps):
path mutations BEFORE elevations BEFORE towers BEFORE enemies
(pathfinding grid + tower-Y derivation) → turn number BEFORE mortar zones
(expiry) → tower graph rebuild() BEFORE graph overlay restore() → setMaxWaves
BEFORE GameState restore (phase guard) → GameState LAST (triggers UI
subscribers). Component delegates via `restoreFromCheckpoint()` thin
wrapper; fallback path goes back through `initFreshEncounter()`.

**Serializing services** (13): GameState, DeckService, CardEffectService,
WaveService, TowerCombatService, EnemyService, StatusEffectService,
CombatLoopService, RelicService, GameStatsService, ChallengeTrackingService,
AscensionModifierService, WavePreviewService, ItemService, RunStateFlagService,
ElevationService, PathMutationService, TowerGraphService.

**Migration chain:** v1 → v2 → … → v10. Each migration adds the missing fields
for the next version; stale fields are migrated forward, never deleted
mid-chain. Structural validation guards against corrupt payloads.

## Archetype Systems (Phases 2-4)

Three spatial archetypes ship on this branch. All are turn-based. Siegeworks
(Phase 5) is deferred — the archetype enum value + Codex filter chip exist;
0 cards live in the pool.

### Cartographer (Phase 2)
**Mechanic:** reshape the board at runtime.

- `PathMutationService` (component-scoped in GameModule) — tile CRUD:
  `build`, `block`, `destroy`, `bridgehead`. Mutations tracked in a journal
  with expiry; CARTOGRAPHER_SEAL anchors every mutation as permanent.
- `PathfindingService.findLongestPath` for DETOUR routing.
- Shared terraform tile material pool (`TerraformMaterialPoolService`) to
  avoid per-tile material churn.
- 8 cards, 2 relics.

### Highground (Phase 3)
**Mechanic:** per-tile elevation raises range / damage / exposes enemies.

- `ElevationService` (component-scoped) — per-tile integer elevation; raise /
  depress / collapse ops; journal-based expiry; max-elevation query for
  KING_OF_THE_HILL.
- Elevation composes into `composeDamageStack()` via passive range bonus,
  HIGH_PERCH range, VANTAGE_POINT damage, KING_OF_THE_HILL damage.
- `LineOfSightService` — elevation-aware LOS check for tower fire.
- Exposed enemies take +25% damage on negative-elevation tiles
  (`ELEVATION_CONFIG.EXPOSED_DAMAGE_BONUS`).
- Cliff column meshes rendered via `TerraformMaterialPoolService` cliff
  material entry.
- 8 cards, 2 relics, 2 new enemies (TITAN elite, GLIDER), 1 boss
  (WYRM_ASCENDANT).

### Conduit (Phase 4)
**Mechanic:** adjacency between towers — cluster / neighbor-gated bonuses.

- `TowerGraphService` (component-scoped) — 4-dir adjacency graph; cluster
  membership via union-find; virtual edges (CONDUIT_BRIDGE) with turn-based
  expiry; disruption entries shrink clusters without topology changes.
- `LinkMeshService` (component-scoped) — live Three.js mesh layer subscribing
  to `edgesAdded$` / `edgesRemoved$` observables; shared materials disposed
  once.
- Neighbor-gated cards read `getNeighbors` / `getClusterSize` / cluster-member
  aggregates in `composeDamageStack`.
- ARCHITECT flag swaps neighbor-count source to `clusterSize - 1` for
  HANDSHAKE / GRID_SURGE.
- HIVE_MIND prepass: compose every tower's damage stack up-front, then the
  per-tower fire loop picks MAX across cluster members. Upgraded tier also
  propagates secondary stats (splash / chain / blast / DoT / status) from
  the strongest member.
- 8 cards, 2 relics.

See `docs/design/conduit-adjacency-graph.md` for the Phase 4 design spike.

## Card System

**`CardDefinition`** (`run/models/card.model.ts`) — static lookup keyed by `CardId`.
Effect dispatched via discriminated union: `TowerCardEffect`, `SpellCardEffect`,
`ModifierCardEffect`, `UtilityCardEffect`, `TerraformTargetCardEffect`,
`ElevationTargetCardEffect`.

**`CardInstance`** — deck entry. Stores `{ instanceId, cardId, upgraded }` only;
archetype / effect / cost all re-derived from `CARD_DEFINITIONS` at read time.
`getActiveTowerEffect(card)` and `getEffectiveEnergyCost(card)` route through
the upgrade flag.

**Checkpoint:** only `cardId` + `instanceId` + `upgraded` are serialized.
Archetype tagging and `upgradedEnergyCost` live on the static definition and
need no migration when those fields change.

**Archetype tagging:** `CardDefinition.archetype?: CardArchetype`. Defaults to
`'neutral'` via `def.archetype ?? 'neutral'` in both `DeckService` and the
Codex. Neutral cards (starter / draw / scout) omit the field.

**Reward weighting:** `RunService.pickArchetypeAwareCard` — 60% dominant-
archetype / 40% neutral, 0% other archetypes. Dominant archetype is the
archetype with the most cards across all 4 piles; ties return `'neutral'`
(anti-flapping). Used by both card-reward pools and the card section of
`generateShopItems`.

## Data Flow (run → combat → run)

```
RunService
  └─ runState$ BehaviorSubject (phase, act, node, gold, lives, relics, deck)
  └─ nodeMap$ BehaviorSubject

RunHubComponent → click combat node
  ↳ RunService.prepareEncounter()
      ↳ EncounterService.prepareEncounter()
          ↳ WaveGeneratorService.generateWaves()
          ↳ MapBridgeService.setEditorMapState()
  ↳ router.navigate(['/play'])

GameBoardComponent.ngOnInit
  ↳ MapBridgeService.getMap() → board[row][col]
  ↳ DeckService.initializeDeck(runState.deckCardIds, seed)
  ↳ RelicService.applyRelics(runState.relicIds)
  ↳ CombatLoopService (turn loop coordinator)
      ↳ player plays cards → CardPlayService dispatches effects
      ↳ End Turn → CombatLoopService.resolveTurn
          ↳ tickTurn across 6 services (elevation, path-mutation,
            tower-graph, status-effect, card-effect, mortar-zone)
          ↳ EnemyService.stepEnemiesOneTurn
          ↳ TowerCombatService.fireTurn (composeDamageStack prepass)
          ↳ CombatLoopService wave-complete check
      ↳ Auto-save via WaveCombatFacadeService.endTurn → EncounterCheckpointService

On VICTORY / DEFEAT
  ↳ GameEndService.recordResult()
  ↳ RunService.recordEncounterResult()
  ↳ router.navigate(['/run'])
      ↳ show reward screen (victory) or summary (defeat)
```

## `composeDamageStack()` (Phase 4 refactor)

Central damage / range composition in `TowerCombatService.composeDamageStack`.
Consumes a `DamageStackContext` built once per `fireTurn` and returns
`{ damage, range, towerVantagePointDmgMult, towerKothMult }` per tower.

Multiplier chain (damage):
```
baseStats.damage
  × towerDamageMultiplier          (relic: universal damage)
  × relicDamage                    (relic: per-tower-type damage)
  × (1 + cardDamageBoost)          (card: DAMAGE_BOOST stack)
  × sniperBoost                    (card: SNIPER_FOCUS — SNIPER only)
  × cardDamageMult                 (card-placement override)
  × pathLengthMultiplier           (card: LABYRINTH_MIND)
  × vantagePointDmgMult            (card: VANTAGE_POINT — elevation ≥ 1)
  × kothMult                       (card: KING_OF_THE_HILL — max-elevation towers)
  × handshakeMult                  (card: HANDSHAKE — ≥ 1 neighbor)
  × gridSurgeMult                  (card: GRID_SURGE — 4 neighbors)
  × tuningForkMult                 (relic: TUNING_FORK — ≥ 1 neighbor)
```

Range: additive `rangeAdditive` (FORMATION) folds INSIDE `(base + additive)`
per spike §13, then standard multipliers (relic / card / elevation / HIGH_PERCH).

HIVE_MIND is handled OUTSIDE the stack via a per-fireTurn prepass so every
tower sees every cluster member's composed damage before firing.

## Constants Architecture

`game/game-board/constants/` — 20+ files, partial `index.ts` barrel.
Not every file is re-exported (`elevation.constants.ts`, `conduit.constants.ts`,
`cartographer.constants.ts` are imported directly to keep the barrel from
growing unbounded).

| File | Contents |
|------|----------|
| `board`, `camera`, `rendering`, `lighting` | Board geometry, camera, Three.js renderer, lights |
| `combat`, `physics`, `status-effect` | Combat rules, 1/60 timestep, SLOW / BURN / POISON |
| `particle`, `effects`, `minimap`, `path` | VFX, bloom, minimap, path overlay |
| `audio`, `ui`, `preview`, `damage-popup`, `touch` | SFX, HUD, ghost tower, popups, touch targets |
| `elevation` | Highground-archetype config (ELEVATION_CONFIG.EXPOSED_DAMAGE_BONUS, HIGH_PERCH threshold, cliff material color, GRAVITY_WELL tiers) |
| `conduit` | Conduit-archetype config (cardinal-4 adjacency, FORMATION min line, LINKWORK fire-rate bonus, HIVE_MIND tier) |
| `cartographer` | Cartographer-archetype config (DETOUR damage tier) |

**Rule:** Balance values (tower stats, enemy stats, wave defs, card costs)
live in `models/*.model.ts` or `run/constants/card-definitions.ts`
`CARD_VALUES`; game-side constants files mirror what the game services read
to avoid cross-boundary imports from `run/constants` into `game/constants`.

## Coordinate Systems

- **Editor:** `tiles[x][z]` — column-major, `x` = column, `z` = row
- **Game:** `board[row][col]` — row-major
- **World:** `{x, y, z}` with `y` = height
- **Conversion:** `board[row][col] = editor.tiles[col][row]`

## Red-Team Lessons (cumulative)

Short reminders; long-form discussion in session memory docs.

- Root-scoped services (CardEffectService, DeckService, RelicService,
  TowerGraphService via `GameSessionService`) survive route transitions —
  MUST be explicitly reset between encounters.
- Capture mutable state into locals BEFORE calling methods that null it
  (tryPlaceTower pattern).
- GameState must track its own maxLives / initialLives — never derive from
  DIFFICULTY_PRESETS in run mode.
- DeckService pile searches must include ALL 4 piles (drawPile, hand,
  discardPile, exhaustPile).
- Restore ordering: towers BEFORE enemies (pathfinding grid), turn number
  BEFORE mortar zones (expiry), GameState LAST (triggers UI subscribers).
- `DeckService.resetForEncounter()` must NOT be called during restore —
  it reshuffles the deck.
- `GameStateService.setPhase()` has transition validation — use
  `restoreFromCheckpoint()` which bypasses it.
- Per-wave / per-encounter flags (RelicService.firstLeakBlockedThisWave,
  CardEffectService.TERRAFORM_REFUND_USED_THIS_TURN) must be serialized
  or ride in `cardModifiers` to avoid double-trigger after restore.
- Cross-service composition on shared `GameBoardTile` fields is latent:
  per-service unit specs cannot see it. `setTileType` / `placeTower` /
  `removeTower` MUST preserve every read-only field of the existing tile,
  not just reconstruct from the factory.
- When a component's `providers:` list hosts peer services, sibling services
  must live there too — NOT in the module. Flat TestBeds hide
  `NullInjectorError` that only fires in the browser.
- Tier-sentinel modifiers (TERRAFORM_ANCHOR, HIVE_MIND_CLUSTER_MAX) must
  gate on `getMaxModifierEntryValue`, NOT `getModifierValue` aggregate —
  two base-tier copies (aggregate = 2) otherwise spoof the upgraded tier.

## File Size Reference

Files over 500 LOC — dense, edit carefully:

| File | LOC |
|------|-----|
| `run/constants/card-definitions.ts` | ~2110 |
| `game-board/game-board.component.ts` | ~1880 |
| `game-board/services/tower-combat.service.ts` | ~1170 |
| `run/services/run.service.ts` | ~1180 |
| `game-board/services/enemy.service.ts` | ~1120 |
| `games/novarise/novarise.component.ts` | ~780 |

**Decomposition plan** for `game-board.component.ts` saved at
`docs/refactors/game-board-decomposition-plan.md` — deferred to a future
UI-aware session (all 6 proposed clusters touch template bindings or the
18-step restore coordinator).
