# CLAUDE.md — Novarise Tower Defense

## Quick Reference
- Angular 15 + Three.js tower defense game with map editor
- Tests: `npm test` (Karma, ~4162 specs, headless Chrome)
- Deploy: Cloudflare Pages
- Routes: `/` landing, `/edit` editor, `/maps` select, `/play` game (guarded)
- Path aliases: `@core/*` → `src/app/core/*`, `@shared/*` → `src/app/shared/*`, `@game/*` → `src/app/game/*`, `@campaign/*` → `src/app/campaign/*`
- SCSS partials: `src/styles/_variables.scss`, `_base.scss`, `_animations.scss`, game/editor/page partials

## See Also
- `ARCHITECTURE.md` — directory map, module boundaries, service graph, key file sizes
- `STRATEGIC_AUDIT.md` — sprint history, red team findings, deferred work

## Card Archetype System (Phase 1, 2026-04-17)

Spatial card archetypes are the depth angle for the next 80 sprints. See
`STRATEGIC_AUDIT.md` Phase 1 section + the project memory plan doc.

- `CardArchetype` lives on `CardDefinition` (static lookup), NOT on
  `CardInstance`. Save/restore serializes only `cardId`; archetype is
  re-derived from `CARD_DEFINITIONS` at load. **Do not** add `archetype`
  to `CardInstance` without bumping `CHECKPOINT_VERSION`.
- `DeckService.getDominantArchetype()` returns the archetype with the most
  cards in the deck across all 4 piles. Returns `'neutral'` on ties (anti-
  flapping rule — a single card pickup must not flip the dominant tag back
  and forth).
- Reward pools weight 60% archetype-aligned / 40% neutral via
  `RunService.pickArchetypeAwareCard`. Both `pickCardRewards` (combat
  rewards) and the card section of `generateShopItems` use it.
- New keyword primitives shipped: `terraform` (Cartographer + Highground)
  and `link` (Conduit). `anchor` (Siegeworks) is deferred to sprint 57.
- Archetype-locking rares, archetype-counter bosses, and the player-facing
  dominant-archetype indicator are all deferred to later phases. Do not
  invent earlier surfaces for them without revisiting the plan doc first.

When adding new cards, **always set `archetype`** — do not let it default
to `'neutral'` for content cards. Neutral is reserved for universal cards
(starter, draw, scout, etc.).

## Code Conventions

### No Magic Numbers
Every numeric or color literal must be a named constant. No exceptions.

**Where constants live:**
- Game balance: `models/*.model.ts` (TOWER_CONFIGS, ENEMY_STATS, WAVE_DEFINITIONS)
- Board/rendering: `constants/*.constants.ts` (create as needed per sprint)
- CSS shared values: `:root` custom properties in `styles.css`
- Card surface tokens: `src/styles/_card-tokens.scss` (sizing, rarity, state, animation, archetype badges)

**Rules:**
1. Config objects over flat constants — `CAMERA_CONFIG.fov`, not `CAMERA_FOV`
2. Computed over duplicated — spawner ranges must derive from board dimensions
3. Constants live near consumers — game in `game/constants/`, editor in `novarise/constants/`
4. GLSL shader math constants (e.g., `12.9898`) are standard — document inline, don't extract
5. When you touch a file, extract its magic numbers. No big-bang refactors.

**Existing patterns to follow:** `TOWER_CONFIGS` (tower.model.ts), `ENEMY_STATS` (enemy.model.ts), `WAVE_DEFINITIONS` (wave.model.ts), `TERRAIN_CONFIGS` (terrain-types.enum.ts)

### Three.js Disposal (CRITICAL)
Every Three.js object you create must be disposed in `ngOnDestroy()`.

**Checklist for any component using Three.js:**
- [ ] Cancel `requestAnimationFrame` in `ngOnDestroy()`
- [ ] Unsubscribe all RxJS subscriptions
- [ ] Remove all DOM event listeners (stored as named refs, not anonymous)
- [ ] Call `geometry.dispose()` on every geometry
- [ ] Call `material.dispose()` on every material (handle `Material[]` arrays)
- [ ] Call `.dispose()` on EffectComposer, BloomPass, ShaderPass, render targets
- [ ] Call `renderer.dispose()` and `controls.dispose()` (OrbitControls)
- [ ] Set references to `null` after disposal

**Pattern:** Use a shared `cleanupGameObjects()` method for both `restartGame()` and `ngOnDestroy()`.

### TypeScript
- Strict mode, zero `any` types — enforced by tsconfig
- `const enum` for compile-time-only values (BlockType, SpawnerType)
- String-backed enum for values that cross serialization boundaries (TowerType, EnemyType, TerrainType)
- Non-null assertions (`!:`) only for Angular lifecycle-safe properties

### Testing
- Tests colocated with source (`.spec.ts` next to `.ts`)
- Three.js tests: create real objects, dispose in `afterEach()`
- Component tests that need a canvas: skip `detectChanges()` in basic specs
- `fakeAsync()` wraps `it()` blocks, NEVER `describe()` blocks
- Async subscription tests: unsubscribe in `afterEach()`
- **Shared test helpers** in `game/game-board/testing/`: `test-enemy.factory.ts`, `test-board.factory.ts`, `test-spies.factory.ts` — use these instead of local helpers
- Current test count: ~4162 specs

### State Management
- BehaviorSubject pattern for all reactive state (GameStateService, EditorStateService)
- Confirm-before-spend: verify service mutation succeeds BEFORE deducting resources
- Confirm-before-refund: use returned object as source of truth, not stale component reference

### Game Content Patterns
When adding new towers, enemies, or waves, follow the config-driven pattern:
- Add enum value to `TowerType` or `EnemyType`
- Add stats entry to `TOWER_CONFIGS` or `ENEMY_STATS`
- Tower mesh: add case to `TowerMeshFactoryService.createTowerMesh()`
- Enemy mesh: add case to `EnemyMeshFactoryService.createEnemyMesh()`
- Add tower button to game-board.component.html tower selection panel
- Add tests for the new config values

### Services
- `GameBoardService` is `@Injectable()` (NOT `providedIn: 'root'`) — provided in `GameModule`
- `MapBridgeService` IS `providedIn: 'root'` — lives in `core/services/`, must persist across route transitions
- All root-scoped services live in `core/services/` with barrel export (`index.ts`)
- Editor services (`TerrainEditService`, `EditorStateService`, `EditHistoryService`, `CameraControlService`, `PathValidationService`, `EditorSceneService`, `EditorNotificationService`) provided in `EditorModule`
- New game services (hardening-viii): `GameInputService` (keyboard), `EnemyMeshFactoryService` (enemy meshes), `EnemyVisualService` (status particles/animations) — all component-scoped in `GameBoardComponent`

### Coordinate Systems
- **Editor:** `tiles[x][z]` (column-major, x=column, z=row)
- **Game:** `board[row][col]` (row-major)
- **World:** `{x, y, z}` where y=height
- **Conversion:** `board[row][col] = editor.tiles[col][row]`
