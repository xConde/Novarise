# CLAUDE.md — Novarise Tower Defense

## Project Overview
Angular 15 + Three.js tower defense game with a map editor.
- **`/`** — Landing page (LandingModule, lazy-loaded)
- **`/edit`** — Map editor (EditorModule, lazy-loaded)
- **`/maps`** — Map select (MapSelectModule, lazy-loaded)
- **`/play`** — Tower defense game (GameModule, lazy-loaded, guarded)
- **Tests:** `npm test` (Karma, 1656 tests, headless Chrome)
- **Deploy:** Cloudflare Pages

## Code Conventions

### No Magic Numbers
Every numeric or color literal must be a named constant. No exceptions.

**Where constants live:**
- Game balance: `models/*.model.ts` (TOWER_CONFIGS, ENEMY_STATS, WAVE_DEFINITIONS — already done)
- Board/rendering: `constants/*.constants.ts` (create as needed per sprint)
- CSS shared values: `:root` custom properties in `styles.css`

**Rules:**
1. Config objects over flat constants — `CAMERA_CONFIG.fov`, not `CAMERA_FOV`
2. Computed over duplicated — spawner ranges must derive from board dimensions
3. Constants live near consumers — game in `game/constants/`, editor in `novarise/constants/`
4. GLSL shader math constants (e.g., `12.9898`) are standard — document inline, don't extract
5. When you touch a file, extract its magic numbers into the constants layer. No big-bang refactors.

**Existing good patterns to follow:**
- `TOWER_CONFIGS` in `tower.model.ts` — `Record<TowerType, TowerStats>`
- `ENEMY_STATS` in `enemy.model.ts` — `Record<EnemyType, EnemyStats>`
- `WAVE_DEFINITIONS` in `wave.model.ts` — array of `WaveDefinition`
- `TERRAIN_CONFIGS` in `terrain-types.enum.ts`

### Three.js Disposal (CRITICAL)
Every Three.js object you create must be disposed in `ngOnDestroy()`.

**Checklist for any component using Three.js:**
- [ ] Cancel `requestAnimationFrame` in `ngOnDestroy()`
- [ ] Unsubscribe all RxJS subscriptions
- [ ] Remove all DOM event listeners (stored as named refs, not anonymous)
- [ ] Call `geometry.dispose()` on every geometry
- [ ] Call `material.dispose()` on every material (handle `Material[]` arrays)
- [ ] Call `.dispose()` on EffectComposer, BloomPass, ShaderPass, render targets
- [ ] Call `renderer.dispose()`
- [ ] Call `controls.dispose()` (OrbitControls)
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

### State Management
- BehaviorSubject pattern for all reactive state (GameStateService, EditorStateService)
- Confirm-before-spend: verify service mutation succeeds BEFORE deducting resources
- Confirm-before-refund: use returned object as source of truth, not stale component reference

### Game Content Patterns
When adding new towers, enemies, or waves, follow the established config-driven pattern:
- Add enum value to `TowerType` or `EnemyType`
- Add stats entry to `TOWER_CONFIGS` or `ENEMY_STATS`
- Add mesh creation case to `GameBoardService.createTowerMesh()`
- Add tower button to game-board.component.html tower selection panel
- Add tests for the new config values
- Run `/new-tower` or `/new-enemy` skill for scaffolding guidance

### Services
- `GameBoardService` is `@Injectable()` (NOT `providedIn: 'root'`) — provided in `GameModule`
- `MapBridgeService` IS `providedIn: 'root'` — must persist across route transitions
- Editor services are provided in `EditorModule`

### Coordinate Systems
- **Editor:** `tiles[x][z]` (column-major, x=column, z=row)
- **Game:** `board[row][col]` (row-major)
- **World:** `{x, y, z}` where y=height
- **Conversion:** `board[row][col] = editor.tiles[col][row]`

## Key Files
| File | Purpose |
|------|---------|
| `game-board.component.ts` | Game renderer, loop, UI (~1,800 LOC) |
| `novarise.component.ts` | Editor renderer, interactions (~1,880 LOC) |
| `tower.model.ts` | Tower configs, upgrade math |
| `enemy.model.ts` | Enemy configs, pathfinding types |
| `wave.model.ts` | Wave definitions |
| `game-state.model.ts` | Game phase enum, initial state |
| `map-bridge.service.ts` | Editor→Game map conversion (root injectable) |
| `game-modifier.model.ts` | Modifier configs, merge logic, score multipliers |
| `status-effect.service.ts` | SLOW/BURN/POISON effects, immunity, speed restoration |
| `tower-combat.service.ts` | Targeting, projectiles, chain, mortar, spatial grid |
| `STRATEGIC_AUDIT.md` | Master sprint roadmap + red team findings |

## Sprint Workflow

```
/sprint-kickoff → /closer → /red-team → /closer --continue → push PR
                                                                  ↓
                                                           PR review feedback
                                                                  ↓
                                                           /review-fix
                                                                  ↓
                                                ┌── <3 bugs → push fix
                                                └── ≥3 bugs → /red-team → push fix
```

| Step | Skill | What happens |
|------|-------|-------------|
| 1. Plan | `/sprint-kickoff` | Audit repo, produce battle plan, wait for approval |
| 2. Build | `/closer` | Execute battle plan autonomously (code → test → commit loop) |
| 3. Review | `/red-team` | Hostile review: magic numbers, disposal, logic holes |
| 4. Fix | `/closer --continue` | Fix red-team findings, re-test, push PR |
| 5. Feedback | `/review-fix` | Ingest PR review comments, triage, fix, re-validate |

Step 5 loops: if the reviewer finds ≥3 real bugs, `/red-team` runs again before pushing. This catches systemic issues the first red-team pass missed rather than playing whack-a-mole.

The old `.claude/tasks/` protocols still work for quick one-offs or other repos. These skills replace them for Novarise with project-specific checks baked in.

## Skills Available

### Sprint Workflow (manual only)
- `/sprint-kickoff` — Audit → battle plan → user approval (no auto-coding)
- `/closer` — Autonomous execution loop with full test suite on every commit
- `/red-team` — Hostile review with Novarise-specific scans (magic numbers, disposal, coordinates, state mutation)
- `/review-fix` — Ingest PR review feedback, triage findings, fix real issues, re-validate
- `/preflight` — Pre-PR quality gate (tests, magic numbers, disposal check)

### Content Scaffolding (manual only)
- `/new-tower` — Scaffold a new tower type end-to-end (enum → config → mesh → UI → tests)
- `/new-enemy` — Scaffold a new enemy type end-to-end (enum → config → waves → tests)

### Background Knowledge (auto-loaded by Claude)
- `constants-guide` — Magic number prevention rules, constants architecture, config object patterns
- `three-js-patterns` — Disposal protocol, material handling, event listener patterns, raycasting
