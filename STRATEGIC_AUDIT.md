# Strategic Audit — 2026-03-03 (header state as of initial audit; see red team sections for current state)

## Current State (as of 2026-03-17)

**Stack:** Angular 15 + Three.js | 3221+ tests passing | Karma + headless Chrome
**Six routes:** Landing (`/`), Campaign (`/campaign`), Map Editor (`/edit`), Map Select (`/maps`), Game (`/play`, guarded), Profile (`/profile`)
**Core loop:** 6 tower types (Basic, Sniper, Splash, Slow, Chain, Mortar), 8 enemy types, 10 waves + endless, 4 difficulties, 8 modifiers
**Combat:** A* pathfinding, spatial grid, object pool, status effects (SLOW/BURN/POISON), L3 specialization branching
**Visuals:** Bloom, vignette, skybox, particles, custom tower meshes, health bars, status effect tinting
**Editor:** 4 terrain types, brush/fill/rectangle tools, undo/redo, save/load/export, mobile joystick, path validation
**Progression:** 16-level campaign, per-map challenges, 26 achievements (4 categories), tutorial, enemy encyclopedia, wave income feedback

---

## Momentum & Zombies

**What's mostly done but not shipping?**
The game. The core TD loop is ~90% complete — you can place towers, fight 10 waves, win or lose. The editor can produce maps and feed them to the game. But it's a *tech demo*, not a game people want to replay. There's no juice, no progression hook, no reason to come back.

**Zombie branches (merged, can prune):**
- `feat/velocity-full-sweep`, `feat/velocity-gameplay-loop`, `feat/velocity-play-loop`, `feat/velocity-tech-debt`, `feat/velocity-tower-upgrades`
- 8 remote `claude/*` experiment branches (dead)

**Resolved bugs:**
- ~~`novarise.component.ngOnDestroy()` never calls `terrainGrid.dispose()`~~ — already fixed (line 1820).

---

## The Gap

The game has **mechanics** but no **feel**. No audio, no screen feedback on kills, no pause, no difficulty curve players can control, no map validation, no reason to replay. The editor can produce broken maps (no path validation). These aren't features — they're the difference between a prototype and something you'd show someone.

---

## Cross-Cutting Concern: Magic Numbers Strategy

### Current State
~200+ magic numbers across the codebase. Game balance configs (`TOWER_CONFIGS`, `ENEMY_STATS`, `WAVE_DEFINITIONS`) are well-extracted and designer-friendly. Everything else — scene setup, camera, meshes, particles, health bars, board dimensions — is inline.

### Highest Risk
**Board dimensions `25×20`** duplicated in 3 places in `game-board.service.ts`. Spawner corner coordinates are hardcoded assuming that exact size. Editor maps can be any size, so this will break when we ship variable-size maps.

### Constants Architecture (applied incrementally per sprint)

```
src/app/game/game-board/
├── constants/
│   ├── board.constants.ts        # Board size, tile size, spawner ranges (computed)
│   ├── rendering.constants.ts    # Scene colors, fog, tone mapping, post-processing
│   ├── lighting.constants.ts     # All light configs (position, color, intensity, shadows)
│   ├── camera.constants.ts       # FOV, near/far, orbit bounds, damping
│   ├── particle.constants.ts     # Count, colors, size, animation speeds
│   └── ui.constants.ts           # Health bar dims/thresholds, projectile visuals
├── models/
│   ├── tower.model.ts            # ✅ Already good (TOWER_CONFIGS, UPGRADE_MULTIPLIERS)
│   ├── enemy.model.ts            # ✅ Already good (ENEMY_STATS)
│   ├── wave.model.ts             # ✅ Already good (WAVE_DEFINITIONS)
│   └── game-state.model.ts       # Needs: DIFFICULTY_PRESETS for lives/gold per mode

src/app/games/novarise/
├── constants/
│   ├── editor-scene.constants.ts # Editor lighting, fog, skybox, post-processing
│   ├── editor-camera.constants.ts# Camera speeds, bounds, angles (from camera-control.service)
│   └── editor-ui.constants.ts    # Brush indicator dims, marker geometry, throttle timing
├── models/
│   └── terrain-types.enum.ts     # ✅ Already good (TERRAIN_CONFIGS)
```

### Rules Going Forward
1. **No new magic numbers.** Every numeric/color literal gets a named constant in the appropriate file.
2. **Config objects over flat constants.** Group related values: `CAMERA_CONFIG.fov`, not `CAMERA_FOV`.
3. **Computed over duplicated.** Spawner ranges derive from board size, not hardcoded corners.
4. **Constants live near their consumers.** Game constants in `game/constants/`, editor in `novarise/constants/`.
5. **Shader constants get comments, not extraction.** GLSL math constants (`12.9898`, `78.233`) are standard — document inline, don't extract.
6. **CSS custom properties for shared values.** Breakpoints, theme colors already use `:root` vars — extend this.
7. **Each sprint extracts its own constants.** Don't do a big-bang refactor. When you touch a file, extract its magic numbers into the constants layer.

### What's Already Right (don't touch)
- `TOWER_CONFIGS` / `UPGRADE_MULTIPLIERS` / `MAX_TOWER_LEVEL` in `tower.model.ts`
- `ENEMY_STATS` in `enemy.model.ts`
- `WAVE_DEFINITIONS` in `wave.model.ts`
- `TERRAIN_CONFIGS` in `terrain-types.enum.ts`
- CSS `:root` variables for theme colors

### Sprint-Specific Extraction Plan

| Sprint | Constants to Extract |
|--------|---------------------|
| **S0** | `board.constants.ts` (board size, tile size, spawner ranges computed from size) |
| **S1** | `editor-ui.constants.ts` (brush sizes, throttle, marker geometry) |
| **S2** | `rendering.constants.ts` + `particle.constants.ts` + `ui.constants.ts` (health bar, projectile visuals) |
| **S3** | `camera.constants.ts` (game camera bounds, speed controls) |
| **S4** | `DIFFICULTY_PRESETS` in `game-state.model.ts` (lives/gold per difficulty) |
| **S5** | New tower/enemy configs extend existing pattern (no new files needed) |

---

## Master Sprint Roadmap

### Sprint 0A: Repo Cleanup (1 session)
**Goal:** Zero-risk cleanup. No logic changes, no refactors. Just pruning and fixing the one known bug.
**Risk:** None — branch deletion and a one-liner leak fix.

- [ ] Fix TerrainGrid memory leak (add `terrainGrid.dispose()` in `novarise.component.ngOnDestroy`)
- [ ] Prune merged local branches (5 feat/velocity-* branches)
- [ ] Prune dead remote claude/* branches (8 branches)
- [ ] Upgrade stale deps (rxjs 7.4→7.8, zone.js 0.11→0.13, @types/node 12→20)
- [ ] Run full test suite — confirm 579/579 still green after dep upgrades

---

### Sprint 0B: Constants Foundation (1 session)
**Goal:** Create the constants architecture that skills and CLAUDE.md reference. After this sprint, the repo matches the tooling.
**Risk:** Medium — rewiring GameBoardService to use constants could break board generation. Full test suite required per commit.

- [ ] Create `src/app/game/game-board/constants/board.constants.ts` — `BOARD_CONFIG { width, height, tileSize, tileHeight }`
- [ ] Rewire `GameBoardService` to use `BOARD_CONFIG` instead of hardcoded `25, 20, 1, 0.2`
- [ ] Make spawner ranges computed from `BOARD_CONFIG.width` / `BOARD_CONFIG.height` (not hardcoded `[23,24]`, `[18,19]`)
- [ ] Extract `disposeMaterial()` to shared utility (currently duplicated in `game-board.component.ts`, `terrain-grid.class.ts`, `tower-combat.service.ts`)
- [ ] Extract world↔grid coordinate conversion to `GameBoardService` helper (currently inline in multiple services)
- [ ] Run full test suite — confirm 579/579 green

---

### Sprint 0C: Game-Side Magic Numbers (1-2 sessions)
**Goal:** Extract the ~120 magic numbers from `game-board.component.ts` and game services into constants files. This is the highest-density file in the repo.
**Risk:** Medium — touching rendering code risks visual regressions. Manual visual check required after each constants file.

- [ ] Create `rendering.constants.ts` — scene background, fog density, tone mapping exposure, bloom params, vignette params
- [ ] Create `lighting.constants.ts` — all 6 lights (ambient, directional, 3 point, under) with position/color/intensity/shadow configs
- [ ] Create `camera.constants.ts` — FOV, near/far, distance, orbit bounds, damping, polar angle
- [ ] Create `particle.constants.ts` — count (400), position ranges, color thresholds, size, opacity, animation speeds
- [ ] Create `ui.constants.ts` — health bar dims/colors/thresholds, projectile sphere geometry, tower scale/emissive per level, range preview opacity
- [ ] Wire all constants into `game-board.component.ts`, `enemy.service.ts`, `tower-combat.service.ts`
- [ ] Run full test suite + manual visual check (game renders correctly with constants)

---

### Sprint 0D: Editor-Side Magic Numbers (1-2 sessions)
**Goal:** Extract the ~80 magic numbers from `novarise.component.ts` and editor services into constants files.
**Risk:** Same as 0C — visual regressions possible.

- [ ] Create `editor-scene.constants.ts` — editor lighting (6+ lights), fog, skybox shader params, post-processing
- [ ] Create `editor-camera.constants.ts` — camera speeds, bounds, angles from `camera-control.service.ts` (12 values)
- [ ] Create `editor-ui.constants.ts` — brush indicator geometry, marker geometry/colors, edit throttle, grid size, height limits, smoothing factor
- [ ] Wire all constants into `novarise.component.ts`, `camera-control.service.ts`, `terrain-grid.class.ts`
- [ ] Run full test suite + manual visual check (editor renders correctly with constants)

---

### Sprint 1: Editor Integrity (2-3 sessions)
**Goal:** You can't make a bad map.

- [ ] **Path validation** — BFS/DFS from spawn→exit on paint/place, block invalid edits or warn
- [ ] **Spawn/exit placement rules** — prevent same tile, prevent on walls, visual feedback on invalid
- [ ] **Map delete from UI** — API exists, add button to load dialog
- [ ] **Rename saved maps** — edit name after first save
- [ ] **Editor minimap** — small overhead canvas showing full layout, click-to-navigate
- [ ] **Terrain height + pathfinding interaction** — define whether height blocks pathing
- [ ] **Constants:** Create `editor-ui.constants.ts` — brush sizes, edit throttle `50ms`, marker geometry, grid size `25`, height max `5`, smoothing factor `0.3`
- [ ] **Constants:** Create `editor-scene.constants.ts` — editor lighting config, fog, skybox shader params, particle config

---

### Sprint 2: Game Feel / Juice (2-3 sessions)
**Goal:** The game feels good to play — audio, feedback, polish.

- [ ] **Audio engine** — Web Audio API service, spatial audio for towers/enemies
- [ ] **SFX:** tower fire, enemy hit, enemy death, wave start, wave clear, gold earned, tower place, upgrade, sell, defeat, victory
- [ ] **BGM:** ambient loop with intensity shift during combat
- [ ] **Kill feedback** — particle burst on enemy death, brief flash on tower fire
- [ ] **Screen shake** — subtle camera shake on boss hits or life loss
- [ ] **Gold popup** — floating "+10g" text on enemy kill (3D text or HTML overlay)
- [ ] **Tower placement preview** — ghost tower + range ring before click-to-place
- [ ] **Mute/volume toggle** in HUD
- [ ] **Constants:** Create `rendering.constants.ts` — scene colors, fog density, tone mapping, bloom/vignette params
- [ ] **Constants:** Create `lighting.constants.ts` — all light positions/colors/intensities/shadow configs
- [ ] **Constants:** Create `particle.constants.ts` — count, spawn ranges, colors, animation speeds
- [ ] **Constants:** Create `ui.constants.ts` — health bar dims/colors/thresholds (`0.6`/`0.3`), projectile sphere radius/opacity/spawn height

---

### Sprint 3: Player Control (1-2 sessions)
**Goal:** Players control the pace.

- [ ] **Pause/resume** — P key or button, freezes game time, grays scene
- [ ] **Speed controls** — 1x / 2x / 3x toggle, affects deltaTime multiplier
- [ ] **Fast-forward between waves** — auto-skip intermission timer
- [ ] **Restart wave** — option to retry current wave (costs a life?)
- [ ] **Camera controls in game** — WASD or drag to pan the game camera
- [ ] **Constants:** Create `camera.constants.ts` — game camera FOV, near/far, orbit bounds, damping factor, min/max distance

---

### Sprint 4: Difficulty & Replayability (2 sessions)
**Goal:** Players choose their challenge and want to replay.

- [ ] **Difficulty modes** — Easy (30 lives, 300g) / Normal (20, 200) / Hard (10, 100) / Nightmare (5, 50) — extract as `DIFFICULTY_PRESETS` in `game-state.model.ts`
- [ ] **Star rating** — 3 stars based on lives remaining (3★ = no lives lost, 2★ = ≤3 lost, 1★ = survived)
- [ ] **Score breakdown** — end-of-game screen with kills, gold earned, towers built, time
- [ ] **Map select screen** — grid of saved maps with best score/stars per difficulty
- [ ] **Endless mode** — waves keep scaling past 10 with procedural difficulty
- [ ] **Leaderboard** (local) — top 10 scores per map stored in localStorage

---

### Sprint 5: Content Expansion (2-3 sessions)
**Goal:** More variety in towers and enemies.

- [ ] **New tower types:**
  - Slow Tower — reduces enemy speed in range (no damage, utility)
  - Chain Lightning — bounces between nearby enemies
  - Mortar — area denial, damages ground zone over time
- [ ] **New enemy types:**
  - Shielded — takes reduced damage until shield breaks
  - Swarm — spawns 3 mini-enemies on death
  - Healer — slowly heals nearby enemies
  - Stealth — invisible until within tower range
- [ ] **Tower abilities** — active skill per tower (cooldown), e.g., sniper "Overcharge" does 3x damage once
- [ ] **Enemy wave editor** — define custom waves in the map editor

---

### Sprint 6: Map Editor Pro (2 sessions)
**Goal:** Map creation is fast, fun, and shareable.

- [ ] **Map templates** — "Classic Path", "Maze", "Spiral", "Open Field" starters
- [ ] **Symmetry tools** — horizontal/vertical mirror brush
- [ ] **Copy/paste regions** — select area, paste elsewhere
- [ ] **Undo history browser** — visual timeline, click to jump
- [ ] **Map sharing** — export as URL (base64 encoded state) or QR code
- [ ] **Map thumbnail** — auto-capture screenshot on save for map select grid

---

### Sprint 7: Mobile & Touch (2 sessions)
**Goal:** Playable on phones and tablets.

- [ ] **Touch tower placement** — tap tile to place, long-press for info
- [ ] **Touch-friendly HUD** — larger buttons, bottom-anchored tower panel
- [ ] **Pinch-to-zoom** — camera zoom via touch gestures
- [ ] **Responsive layout** — game UI adapts to portrait/landscape
- [ ] **Performance budget** — profile on mid-range phone, reduce draw calls if needed

---

### Sprint 8: Persistence & Progression (2 sessions)
**Goal:** Progress carries across sessions.

- [ ] **Player profile** — localStorage player stats (total kills, gold earned, maps completed)
- [ ] **Unlock system** — tower types unlocked by completing maps (start with Basic only)
- [ ] **Achievement badges** — "First Blood", "Perfect Wave", "Boss Slayer", etc.
- [ ] **Campaign mode** — ordered sequence of 5-10 built-in maps with increasing difficulty
- [ ] **Settings persistence** — volume, difficulty, speed preference saved

---

### Sprint 9: Infrastructure (1-2 sessions)
**Goal:** CI/CD, deploy, monitoring.

- [ ] **Angular upgrade path** — 15 → 16 → 17 (incremental, one major at a time)
- [ ] **Cloudflare Pages deploy** — production build + deploy pipeline
- [ ] **Bundle analysis** — three.js tree-shaking audit, code-split analysis
- [ ] **Performance monitoring** — FPS counter in dev, Three.js stats panel
- [ ] **Error tracking** — catch and surface runtime errors gracefully
- [ ] **PWA** — offline support, installable on mobile

---

## Sprint Priority Matrix

| Sprint | Impact | Effort | Risk | Dependency | Ship Without? |
|--------|--------|--------|------|------------|---------------|
| **0A: Repo Cleanup** | Low | Low | None | None | No — leak + stale deps |
| **0B: Constants Foundation** | **Critical** | Medium | Medium | 0A | No — skills reference it |
| **0C: Game Magic Numbers** | High | Medium | Medium | 0B | Technically yes — but drift accelerates |
| **0D: Editor Magic Numbers** | High | Medium | Medium | 0B | Same as 0C |
| **1: Editor Integrity** | High | Medium | Low | 0A, 0B | No — broken maps = broken game |
| **2: Game Feel** | **Critical** | Medium | Low | 0A, 0B | No — this IS the game |
| **3: Player Control** | High | Low | Low | 0A | Maybe — but frustrating |
| **4: Replayability** | High | Medium | Low | S1, S2 | Yes — but no retention |
| **5: Content** | Medium | High | Low | S2 | Yes — 3 towers works for v1 |
| **6: Editor Pro** | Medium | Medium | Low | S1 | Yes — editor works today |
| **7: Mobile** | Medium | Medium | Medium | S2, S3 | Yes — desktop-first is fine |
| **8: Progression** | Medium | Medium | Low | S4 | Yes — nice-to-have for v1 |
| **9: Infrastructure** | Low | Medium | Low | Any | Yes — manual deploy works |

---

## Recommended Order

```
S0A (Cleanup) → S0B (Constants Foundation)
                        ↓
            ┌── S0C (Game Magic Numbers)      ← can parallel with 0D
            └── S0D (Editor Magic Numbers)    ← can parallel with 0C
                        ↓
               S1 (Editor Integrity) → S2 (Game Feel)
                                            ↓
                                       S3 (Player Control)
                                            ↓
                                       S4 (Replayability)
                                            ↓
                              S5 (Content) + S6 (Editor Pro)  ← parallel
                                            ↓
                                  S7 (Mobile) + S8 (Progression) ← parallel
                                            ↓
                                    S9 (Infrastructure)
```

**"Product foundations" milestone:** After feat/product-foundations (S3+S4+S8 subset)
**"Repo aligned with tooling" milestone:** After S0A + S0B
**"Magic number debt cleared" milestone:** After S0C + S0D
**"Playable demo" milestone:** After S1 + S2 + S3
**"Show someone" milestone:** After S4
**"Ship it" milestone:** After S7 + S9

---

## Completed: Product Foundations (feat/product-foundations) — 2026-03-06

### What shipped
Cross-cutting sprint pulling from S3, S4, S6, and S8 to establish product fundamentals:

| Feature | Sprint Origin | Status |
|---------|--------------|--------|
| Pause/resume (P key + overlay) | S3 | Done |
| Difficulty selector (Easy/Normal/Hard/Nightmare) | S4 | Done |
| Endless mode (procedural waves past wave 10) | S4 | Done |
| Achievement system (8 achievements + unlock tracking) | S8 | Done |
| Player profile page (`/profile`) | S8 | Done |
| Map select screen (`/maps`) with edit/delete | S4 | Done |
| Landing page with nav to all features | — | Done |
| Map template selector in editor | S6 | Done |
| Route guard on `/play` (requires map or quickplay param) | — | Done |
| Settings persistence (difficulty, speed) | S8 | Done |
| Game navigation (Home/Edit buttons with pause-before-confirm) | — | Done |

### Red-Team Findings (5 parallel agents, 2026-03-06)

**FIXED (HIGH/MEDIUM):**
1. `achievementDetails` was a getter recomputing every CD cycle — changed to pre-computed field with explicit `updateAchievementDetails()` call
2. `goHome()`/`goToEditor()` showed `confirm()` without pausing — enemies leak during synchronous dialog. Now pauses first, resumes if cancelled
3. Preview cache key omitted gold — stale BFS result after spending gold. Added gold to cache key
4. `'quickplay'` string duplicated in 3 files — consolidated to `QUICK_PLAY_PARAM` constant from game guard
5. Map select `loadMap()` null return left stale cards in UI — now filters out missing maps
6. Profile loaded data in constructor — moved to `ngOnInit` for fresh data on each navigation

**ACCEPTED (LOW — deferred):**
- Some CSS magic numbers in new SCSS files (spacing, font sizes) — extract when touching those files next
- `CanActivate` interface deprecated in Angular 15.2+ — defer to Angular upgrade sprint (S9)
- Game version string not externalized — low priority, defer to S9

### Test delta
- Before: 579 tests
- After: 1332 tests (+753)
- All passing, zero flakes

### Sprint items now partially complete

| Sprint | Items Done | Items Remaining |
|--------|-----------|----------------|
| S3: Player Control | Pause/resume | Speed controls, fast-forward, restart wave, camera pan |
| S4: Replayability | Difficulty modes, endless mode, map select | Star rating, score breakdown, leaderboard |
| S6: Editor Pro | Map templates | Symmetry tools, copy/paste, undo browser, sharing, thumbnails |
| S8: Progression | Profile, achievements, settings | Unlock system, campaign mode |

### Sprint 0C and 0D: Parallel or Sequential?

0C and 0D touch completely different files (game/ vs novarise/). They CAN run in parallel if using separate branches. But if you want to go slow and review each constants extraction carefully, run them sequentially. Either way, they both depend on 0B (the constants architecture must exist before you populate it).

---

## Completed: Engine Depth (feat/engine-depth) — 2026-03-07

### What shipped
10 sprints of engine architecture and gameplay depth:

| Sprint | Feature | Impact |
|--------|---------|--------|
| 1 | Fixed timestep physics (60Hz deterministic) | Framerate-independent gameplay |
| 2 | A* pathfinding MinHeap + Map | O(n log n) vs O(n²) pathfinding |
| 3 | Flying enemy slow immunity | 28 new tests, correct combat behavior |
| 4 | Spatial grid for combat queries | O(1) amortized range checks |
| 5 | Object pool for projectile meshes | Reduced GC pressure |
| 6 | Status effects framework (SLOW/BURN/POISON) | Extensible effect system |
| 7 | Multi-spawner/multi-exit maps (max 4 each) | Map variety, backward-compat v1 |
| 8 | Tower L3 specialization branching (ALPHA/BETA) | Strategic depth per tower |
| 9 | Game modifiers system (8 mutators) | Replayability, score multiplier |
| 10 | Creep leak scaling (enemy-type life cost) | Prioritization pressure |

### Red-Team Findings (2 passes, 2026-03-07)

**Pass 1 (sprints 6-10) — FIXED:**
1. Last spawn/exit removal guard — prevent unplayable maps
2. Speed division hardening — divide-by-zero guard in SPEED_DEMONS

**Pass 2 (all 10 sprints) — FIXED:**
1. MIN_ENEMY_SPEED floor (0.1) — prevent zero/negative speed
2. Modifier combo test coverage — triple-modifier stacking test

**ACCEPTED (LOW):**
- Pre-existing SCSS magic numbers outside branch scope
- Mortar projectiles not pooled (correct disposal, just less efficient)

### Test delta
- Before: 1425 tests
- After: 1638 tests (+213)
- All passing, zero flakes

### Sprint items now partially complete

| Sprint | Items Done | Items Remaining |
|--------|-----------|----------------|
| S2: Game Feel | Audio SFX, screen shake, gold popup, kill feedback, preview | BGM, spatial audio |
| S5: Content | 6 towers, 8 enemies, status effects, specialization | Tower abilities, wave editor |

---

## Red Team Critique — feat/engine-depth Sprints 1-5 (2026-03-06)

### Finding 1: VFX/Audio Storm During Multi-Step Physics (HIGH)
**Location:** `game-board.component.ts:1477-1520` (inside fixed timestep `while` loop)
**Risk:** At 3x game speed, up to 5 physics steps fire per frame. Audio calls (`playTowerFire`, `playEnemyHit`, `playGoldEarned`, `playEnemyDeath`) and visual spawns (`spawnDeathBurst`, `goldPopupService.spawn`, `damagePopupService.spawn`) were called per-step, creating 5x expected popups/particles per frame. Screen shake also triggered per-exit per-step instead of once per frame.
**Fix:** Accumulate kill events, fired tower types, hit counts, and exit counts across all physics steps. Process audio and visual feedback ONCE after the `while` loop exits. Enemy positions are snapshot before removal to ensure deferred popups render at correct locations.

### Finding 2: Projectile Pool Pre-Warm Scene Orphans (LOW — accepted)
**Location:** `tower-combat.service.ts:684` (drain in cleanup)
**Risk:** Pre-warmed pool meshes (created in constructor) are never added to a scene. `drain()` calls `scene.remove(mesh)` on them — this is a Three.js no-op for non-children. No memory leak, no error, just a wasted call.
**Status:** Accepted. Cost is negligible (20 no-op calls on cleanup).

---

## Red Team Pass 1 — feat/engine-depth Sprints 6-10 (2026-03-07)

**FIXED:**
1. **Last spawn/exit removal** — editor allowed toggling off the only spawn/exit point, leaving an unplayable map. Added `length <= 1` guard in `addSpawnPoint()`/`addExitPoint()`.
2. **Speed division fragility** — SPEED_DEMONS selective application divided by modifier value without zero guard. Added `!== 0` check.

**VERIFIED NOT BUGS:**
- Double-specialization: `upgradeTowerWithSpec()` already guards `level !== MAX_TOWER_LEVEL - 1`
- DoT+leak race: kill processing runs before `updateEnemies()`, dead enemies removed first

## Red Team Pass 2 — All 10 Sprints (2026-03-07)

**FIXED:**
1. **MIN_ENEMY_SPEED floor** — no guard prevented `enemy.speed` from going to zero/negative with extreme modifier stacking. Added `MIN_ENEMY_SPEED = 0.1` constant and `Math.max()` floor after all modifier application.
2. **Modifier combo test coverage** — added triple-modifier combo test (ARMORED+FAST+SPEED_DEMONS) and speed floor test.

**ACCEPTED (LOW — deferred):**
- SCSS magic numbers in new UI panels (spec choice, modifier selector) — cosmetic, not runtime risk
- Mortar projectiles not pooled (fresh geometry per fire) — cleanup is correct, just less efficient
- `projectileCounter` increments without upper bound — resets on cleanup, fine per session

---

## Deployment Checklist

- [x] Step 1: Extract SCSS magic numbers in new UI panels to CSS custom properties
- [x] Step 2: Update STRATEGIC_AUDIT.md with completed engine-depth sprint summary
- [x] Step 3: Run full test suite — confirm all 1638+ tests green
- [x] Step 4: Update MEMORY.md with final branch state

## Deployment Checklist — Red Team Pass 3
- [x] Step 1: Wire waveCountMultiplier into WaveService.startWave() + 3 tests
- [x] Step 2: Fix undefined --z-index-hud → --z-index-overlay
- [x] Step 3: Mobile editor bottom-sheet + landscape height cap + test fixes
- [x] Step 4: Run full test suite — confirm 1643 tests green
- [x] Step 5: Push to remote

---

## Red Team Pass 3 — Mobile Responsive + Full Branch Audit (2026-03-07)

### Finding 1: DOUBLE_SPAWN modifier is dead code (CRITICAL)
**Location:** `game-modifier.model.ts:66` defines `waveCountMultiplier: 2.0`, `game-modifier.model.ts:127-128` computes merged value
**Risk:** `waveCountMultiplier` is computed by `mergeModifierEffects()` but **never consumed** anywhere. No wave service or game-board component reads it. Players who enable DOUBLE_SPAWN get a 40% score bonus for zero difficulty increase. This is an exploit — free score multiplier.
**Fix:** Wire `waveCountMultiplier` into wave spawning logic, multiplying `entry.count` when building spawn queues.

### Finding 2: `--z-index-hud` CSS variable undefined (MEDIUM)
**Location:** `game-board.component.scss:36`
**Risk:** `.nav-buttons` uses `z-index: var(--z-index-hud)` but only `--z-index-base` (1), `--z-index-overlay` (10), `--z-index-modal` (100) exist in `styles.css`. Browser resolves undefined custom property to `auto`, making nav button stacking order unpredictable. Could be hidden behind game overlays.
**Fix:** Replace with `var(--z-index-overlay)`.

### Finding 3: Landscape bottom-sheet too tall (MEDIUM)
**Location:** `edit-controls.component.scss:154` — `max-height: 55vh` on mobile
**Risk:** On landscape phones (400px viewport height), panel occupies 220px (55%), leaving only 180px for 3D canvas. Editor becomes nearly unusable in landscape.
**Fix:** Add `@media (max-height: 500px)` rule reducing `max-height` to `40vh`.

### Verified NOT bugs (agent overstated):
- Status effects orphaned on death — already lazily cleaned in `StatusEffectService.update()` via `!enemy || enemy.health <= 0` check (line 78)
- Physics accumulator dropping frames — intentional spiral-of-death prevention, not a bug
- MinHeap bubbleUp bounds — `while (index > 0)` already prevents invalid parent access

## Red Team Pass 4 — Mobile Editor Touch Targets (2026-03-07)

### Finding 1: `.mobile-play-btn` min-height 2rem (MEDIUM)
**Location:** `edit-controls.component.scss:183`
**Risk:** 32px is below WCAG 44px minimum touch target. Users may mis-tap on small phones.
**Fix:** Bump `min-height` from `2rem` to `2.75rem` (44px).

### Finding 2: `.mobile-close-btn` min-height 2.25rem (MEDIUM)
**Location:** `edit-controls.component.scss:212`
**Risk:** 36px is below WCAG 44px minimum. Close button is a critical interaction point.
**Fix:** Bump `min-height` from `2.25rem` to `2.75rem`.

### Finding 3: `.chip` min-height 2.5rem (LOW)
**Location:** `edit-controls.component.scss:240`
**Risk:** 40px is marginally below 44px threshold. Chips are densely packed in grids.
**Fix:** Bump `min-height` from `2.5rem` to `2.75rem`.

### Finding 4: Dead `.close-button` CSS rule (LOW)
**Location:** `edit-controls.component.scss:2`
**Risk:** No element in the template uses `.close-button`. Dead code increases CSS budget.
**Fix:** Remove the rule.

## Red Team Pass 5 — Full Branch Audit (2026-03-07)

### Finding 1: towerCostMultiplier and towerDamageMultiplier modifiers never applied (CRITICAL)
**Location:** `game-board.component.ts:tryPlaceTower()`, `tower-combat.service.ts:fireProjectile()`
**Risk:** EXPENSIVE_TOWERS and GLASS_CANNON modifiers are computed but never consumed. Players get free score bonus from these modifiers with zero gameplay effect. False contract with the player.
**Fix:** Apply `towerCostMultiplier` in `tryPlaceTower()`, tower preview affordability, and upgrade cost. Apply `towerDamageMultiplier` in combat damage calculation.

### Finding 2: Glacier specialization slowFactorOverride has no runtime effect (CRITICAL)
**Location:** `tower-combat.service.ts:applySlowAura()`, `status-effect.constants.ts`
**Risk:** Glacier sets `slowFactorOverride: 0.3` but `applySlowAura()` always uses global config `speedMultiplier: 0.5`. Investing gold in Glacier spec yields zero benefit over base slow tower.
**Fix:** Pass tower-specific slow factor to `StatusEffectService.apply()`.

### Finding 3: Frostbite specialization "deals damage" description is false (MEDIUM)
**Location:** `tower.model.ts:191-195`
**Risk:** Frostbite description says "deals damage" but base Slow has `damage: 0`, and `0 * 1.0 = 0`. Slow aura code path doesn't deal damage anyway.
**Fix:** Change description to match reality — remove damage claim.

### Finding 4: Specialization buttons missing [disabled] attribute (MEDIUM)
**Location:** `game-board.component.html:304`
**Risk:** `.spec-btn` has visual `.unaffordable` class but no `[disabled]` — screen readers/keyboard can still activate.
**Fix:** Add `[disabled]` binding matching the unaffordable condition.

### Finding 5: Dead deleteMapClick output + deleteMap() in editor (LOW)
**Location:** `edit-controls.component.ts:28`, `novarise.component.ts:1129`, `novarise.component.html:39`
**Risk:** Delete button removed from template but output binding, parent handler, and 150+ lines of deleteMap() logic remain as dead code.
**Fix:** Remove output, binding, and method.

### Finding 6: Dead goHome() in game-board component (LOW)
**Location:** `game-board.component.ts:539`
**Risk:** Nav buttons removed from template but method remains. Dead code.
**Fix:** Remove method.

### Finding 7: Magic number 0.6rem in modifier-desc (LOW)
**Location:** `game-board.component.scss:1016`
**Risk:** Violates no-magic-numbers rule. Should use `--font-size-2xs`.
**Fix:** Replace with CSS variable.

### Verified NOT bugs:
- INITIAL_GAME_STATE.activeModifiers shared Set — reset() creates new Set
- emit() mutable Set leak — cloned on emit
- SPEED_DEMONS selective application — math decomposition is correct
- ObjectPool drain() double-dispose — scene.remove() is safe no-op
- StatusEffectService concurrent modification — deferred deletion after loop

## Deployment Checklist — Red Team Pass 5
- [x] Fix Finding 1: Wire towerCostMultiplier into placement, preview, and upgrades
- [x] Fix Finding 2: Pass tower slow factor to StatusEffectService
- [x] Fix Finding 3: Correct Frostbite description
- [x] Fix Finding 4: Add [disabled] to spec buttons
- [x] Fix Findings 5-6: Remove dead code (deleteMapClick, goHome)
- [x] Fix Finding 7: Replace 0.6rem magic number
- [x] Run full test suite (1656/1656), commit, push

## Red Team Pass 6 — Final Branch Audit (2026-03-07)

### Finding 1: Minimap permanently broken after restart (CRITICAL)
**Location:** `game-board.component.ts:636` (cleanup) vs `:303` (init)
**Risk:** `restartGame()` calls `minimapService.cleanup()` which destroys canvas+ctx. `init()` only runs in `ngAfterViewInit()` (one-time hook). Minimap is permanently dead after "Play Again".
**Fix:** Call `minimapService.init(container)` in `restartGame()` after cleanup.

### Finding 2: totalInvested tracks base cost, not modified cost (MEDIUM)
**Location:** `tower-combat.service.ts:110` (registerTower)
**Risk:** With EXPENSIVE_TOWERS/GLASS_CANNON, player pays modified cost but `totalInvested` records base cost. Sell refund is based on base, not actual spend — player loses gold.
**Fix:** Pass actual cost spent to `registerTower()` and thread modified upgrade costs.

### Finding 3: Mortar DoT damage ignores towerDamageMultiplier (MEDIUM)
**Location:** `tower-combat.service.ts:601` (applyDamage → createMortarZone)
**Risk:** Fresh `getEffectiveStats()` call bypasses the damage multiplier. Mortar zones always use base dotDamage. With GLASS_CANNON, mortar pays 2x cost for 1x DoT.
**Fix:** Scale dotDamage by `towerDamageMultiplier` in the mortar zone creation path.

### Finding 4: Undo/redo corrupts spawn/exit with multi-spawn maps (MEDIUM)
**Location:** `novarise.component.ts:752-764`
**Risk:** SpawnPointCommand snapshots single `previousSpawn` but maps can have multiple spawn points. Undo restores only one, losing the rest.
**Fix:** Snapshot full `spawnPoints[]` array and restore on undo.

### Verified NOT bugs:
- towerDamageMultiplier resets on restart (cleanup sets to 1)
- towerCostMultiplier applied in all 4 usage sites
- CSS variables all defined in styles.css
- PathVisualization cleanup/recreate cycle correct
- ObjectPool drain/reuse correct
- startingGoldMultiplier on difficulty change correct
- Three.js disposal in spawn/exit markers correct

## Deployment Checklist — Red Team Pass 6
- [x] Fix Finding 1: Re-init minimap after restart
- [x] Fix Finding 2: Thread actual cost into registerTower + upgrades
- [x] Fix Finding 3: Scale mortar DoT by towerDamageMultiplier
- [x] Fix Finding 4: Snapshot full spawn/exit arrays for undo
- [x] Run full test suite (1656/1656), commit, push

## Red Team Critique — 2026-03-07 (Pass 7)

### Finding 1: Scene Too Dark — Compounding Light + Post-Processing (MEDIUM)
**Location:** `constants/lighting.constants.ts`, `constants/rendering.constants.ts`, `game-board.service.ts:106`
**Risk:** All light colors were dark purples (0x5a4a6a, 0xc0b0d0), bloom threshold too high (0.7) to trigger on dark scene, vignette darkness (0.4) further reduces brightness. Scene appears too dark for comfortable gameplay.
**Fix:** Brighten light colors toward neutral (0x9090a0 ambient, 0xe0d8f0 directional), lower bloom threshold to 0.5, reduce vignette darkness to 0.25, boost tile emissive intensity from 0.15 to 0.25.

### Finding 2: Wave Preview Overflow on Landscape Phones (LOW)
**Location:** `game-board.component.scss:199`
**Risk:** Wave preview panel has no max-height constraint. On landscape phones (~400px viewport height), wave list can overflow off-screen.
**Fix:** Add `max-height: min(40vh, 300px); overflow-y: auto;` to `.wave-preview`.

### Finding 3: Card Actions Z-Index on Touch Devices (LOW)
**Location:** `map-select.component.scss:123`
**Risk:** `.card-actions` positioned absolutely without z-index. On touch devices with long map names, action buttons may be visually occluded by sibling content.
**Fix:** Add `z-index: 2` to `.card-actions`.

### Verified NOT bugs:
- SpawnPointCommand redo logic: toggle handles both add/remove correctly via previousSpawns snapshot
- Mini-swarm slow inheritance: minis spawn at base speed by design, can be independently slowed
- Modifier retroactivity: modifiers locked during COMBAT, no enemies exist during SETUP changes
- Mortar DoT multiplier: already fixed in pass 6 (scales dotDamage before zone creation)
- Targeting mode reset on sell: new tower at same location correctly gets default mode

## Deployment Checklist — Red Team Pass 7
- [x] Fix Finding 1: Brighten lighting constants + post-processing
- [x] Fix Finding 2: Wave preview max-height overflow protection
- [x] Fix Finding 3: Card actions z-index for touch devices
- [x] Run full test suite (1656/1656), commit, push

---

## Red Team Critique — feat/visual-overhaul (2026-03-07)

### Finding 1: Per-frame allocation in getAllActiveEffects() (MEDIUM)
**Location:** `status-effect.service.ts:155`, called from `game-board.component.ts:1727`
**Risk:** Creates new `Map` + `Array.from()` per enemy every frame during combat. With 50+ enemies (swarm spawns, endless), this creates hundreds of short-lived objects/sec, pressuring GC during the render loop.
**Fix:** Reuse a pre-allocated Map, clear-and-repopulate in-place.

### Finding 2: Magic numbers in animations/crown/preview (MEDIUM)
**Location:** `game-board.component.ts:1790,1809,1816`, `enemy.service.ts:529-539`, `tower-preview.service.ts:106-129`
**Risk:** Raw numeric literals for crystal rotation speed, spark phase offset, boss crown geometry, and ghost preview dimensions bypass the constants layer.
**Fix:** Add missing fields to TOWER_ANIM_CONFIG, create BOSS_CROWN_CONFIG, create PREVIEW_GHOST_CONFIG.

### Finding 3: Trail geometry disposal ordering (LOW — FIXED)
**Location:** `tower-combat.service.ts:251,274`
**Risk:** Dispose colocated with reassignment in red team pass 8.

## Red Team Critique — feat/visual-overhaul Pass 2 (2026-03-07)

### Finding 1: Trail creates new BufferGeometry per frame per projectile (MEDIUM — FIXED)
**Location:** `tower-combat.service.ts:248-271`
**Risk:** 360+ geometry create/dispose cycles/sec with 6 towers firing. GC + GPU churn.
**Fix:** Pre-allocate fixed-size buffer, update in-place with needsUpdate + setDrawRange.

### Finding 2: Impact flash creates new SphereGeometry per hit (MEDIUM — FIXED)
**Location:** `tower-combat.service.ts:735-750`
**Risk:** Identical geometry allocated per hit. Should share like ParticleService.
**Fix:** Shared geometry field, dispose in cleanup().

### Finding 3: getAllActiveEffects Array.from per enemy (LOW — ACCEPTED)
**Location:** `status-effect.service.ts:161`
**Risk:** 30 small array allocs/frame during waves. Low real-world impact.
**Status:** Accepted. Consumer could iterate effects directly in future refactor.

## Deployment Checklist — feat/visual-overhaul
- [x] Fix Finding 1: Reuse persistent Map in getAllActiveEffects()
- [x] Fix Finding 2: Extract magic numbers (TOWER_ANIM_CONFIG, BOSS_CROWN_CONFIG, PREVIEW_GHOST_CONFIG)
- [x] Fix Finding 3: Colocate trail geometry dispose with reassignment
- [x] Step 4: Final convention check (console.log, TODO, catch(e), hardcoded numbers)
- [x] Step 5: Full test suite green (1696/1696, hard gate)
- [x] Step 6: Push branch + create PR

## Red Team Critique — feat/visual-overhaul Pass 3 (2026-03-07)

### Finding 1: Health bar billboarding broken by enemy facing rotation (CRITICAL — FIXED)
**Location:** `enemy.service.ts:332-336`
**Risk:** `quaternion.copy(cameraQuat)` sets LOCAL quaternion on a child of a rotated parent. World quaternion becomes `parentRot * cameraQuat` — health bars tilt/rotate with enemy facing direction.
**Fix:** Invert parent world quaternion: `getWorldQuaternion().invert().premultiply(cameraQuat)`.

### Finding 2: Dead export AMBIENT_LIGHT (LOW — FIXED)
**Location:** `lighting.constants.ts:23`
**Fix:** Removed — no consumers after ambient light was removed from game scene.

### Finding 3: Test gaps — trail reuse, flash sharing, facing angle, billboard rotation (HIGH — FIXED)
**Fix:** Added 4 new tests in tower-combat.service.spec.ts (trail setDrawRange reuse, shared flash geometry identity, flash re-creation after cleanup) and strengthened 2 tests in enemy.service.spec.ts (correct facing angle, billboard with rotated parent). 1697→1701 tests.

## Deployment Checklist — feat/visual-overhaul (Closer Pass 2)
- [x] Fix red team pass 2 Finding 1: Pre-allocate trail BufferGeometry, update in-place
- [x] Fix red team pass 2 Finding 2: Share impact flash SphereGeometry across all flashes
- [x] Remove redundant ambient light (hemisphere provides ambient fill)
- [x] Fix tower placement BFS for corner spawners (flood-fill spawner group)
- [x] Fix minimap dimensions for rectangular boards (gridWidth/gridHeight)
- [x] Full test suite green (1697/1697)
- [x] Push to PR

## Red Team Critique — feat/product-fundamentals (2026-03-15)

### Finding 1: Endless mode scores never recorded (CRITICAL)
**Location:** `game-board.component.ts` — both game-end recording blocks (~lines 1724 and 1752)
**Risk:** The `this.scoreBreakdown?.isVictory` guard means only victories trigger `recordMapScore()`. Endless mode always ends in DEFEAT, so endless players — the most engaged audience — have zero per-map score tracking. Their wave-50 grinds are silently thrown away. Additionally, a hard-fought Normal defeat at 5000 points is lost while an Easy victory at 1500 is recorded.
**Fix:** Remove `isVictory` guard from `recordMapScore`. The method already gates on `score > existing.bestScore`. Stars will be 0 for defeats (preserving `bestStars` via `Math.max`), so the best-stars field is safe.

### Finding 2: WebGL context restored double-loop race (MEDIUM)
**Location:** `game-board.component.ts` line ~209, `novarise.component.ts` line ~1612
**Risk:** If a pre-queued RAF callback fires between context loss (which cancels RAF and zeros the id) and context restored (which calls `animate()`), two parallel animation loops start. Double physics updates cause time acceleration, double rendering halves FPS, and accumulated state drifts.
**Fix:** Guard `animate()` call with `if (!this.animationFrameId)` in the restored handler. Same fix needed in editor component.

### Finding 3: Backspace during game-over navigates browser back (LOW)
**Location:** `game-board.component.ts` — `handleKeyboard()` phase guard
**Risk:** The VICTORY/DEFEAT early return skips `preventDefault()` for Backspace, allowing default browser back-navigation. Player viewing score breakdown accidentally presses Backspace → loses the overlay. Mitigated: most modern browsers removed Backspace-as-back.
**Fix:** Move Backspace/Delete `preventDefault()` before the phase guard, or handle it in a separate early block.

## Red Team Critique — feat/product-fundamentals Pass 2 (2026-03-15)

### Finding 1: DEFEAT block still has isVictory guard — previous fix incomplete (CRITICAL)
**Location:** `game-board.component.ts` ~line 1756 (DEFEAT mid-frame block)
**Risk:** The earlier red team fix (commit a792cb1) only patched the VICTORY code path. The DEFEAT code path at ~line 1756 still reads `this.scoreBreakdown?.isVictory` which is always false for defeats. Endless mode scores remain silently unrecorded. The `replace_all` edit failed because the two blocks have different indentation (14 vs 12 spaces), so only the first matched.
**Fix:** Manually patch the DEFEAT block to use `this.scoreBreakdown` (drop `?.isVictory`).

### Finding 2: getMapScore returns mutable internal reference (MEDIUM)
**Location:** `player-profile.service.ts` — `getMapScore()` method
**Risk:** Returns the actual internal `MapScoreRecord` object, not a copy. A caller mutating `record.bestScore = 0` would corrupt the persistent profile. `getAllMapScores()` correctly spreads copies, but `getMapScore()` doesn't — inconsistent with the `getProfile()` immutability pattern.
**Fix:** Return `{ ...this.profile.mapScores[mapId] }` instead of the raw reference.

### Finding 3: createTestEnemy factory completeness (FALSE POSITIVE)
**Location:** `testing/test-enemy.factory.ts`
**Risk:** Initially flagged as missing `baseSpeed`, but `baseSpeed` is NOT part of the Enemy interface. The StatusEffectService tracks original speed via `ActiveEffect.originalSpeed` internally. No fix needed.

## Deployment Checklist — feat/product-fundamentals
- [x] Code cleanup: remove console.log, TODO/FIXME/HACK added on this branch
- [x] Convention check: catch(e) → catch(error), no hardcoded numbers in diff
- [x] Full test suite green (1780/1780)
- [x] Verify both isVictory guards are removed (grep confirmation — only GameEndStats construction remains)

---

## Red Team Critique — feat/gameplay-interaction (2026-03-15)

### Finding 1: Touch drag multi-finger silently drops placement (HIGH)
**Location:** `game-board.component.ts:436,442` (touch drag handlers)
**Risk:** The `touchmove` handler guards `te.touches.length === 1` — if a second finger touches during drag, the handler stops calling `onDragMove`. The `touchend` handler guards `te.changedTouches.length === 1` — if both fingers lift simultaneously, `changedTouches.length === 2` and `onDragEnd` never fires. The drag listeners remain on `window` permanently, `isDragging` stays true, and subsequent touch interactions are corrupted. The `blurDragHandler` only fires on window blur, not on multi-finger release.
**Fix:** Remove the `changedTouches.length === 1` guard in `globalDragEndHandler`. On any `touchend`, cancel the drag. Multi-finger during a tower drag is always an abort, never a valid placement.

### Finding 2: `updateTileHighlights` emissive snapshot races with hover (MEDIUM)
**Location:** `game-board.component.ts:583-585` (origEmissive snapshot)
**Risk:** `updateTileHighlights` snapshots `material.emissive.getHex()` as `origEmissive` before overwriting with the highlight color. If the tile is currently being hovered (intensity set to `TILE_EMISSIVE.hover`), the snapshot captures the hover intensity, not the base. When `clearTileHighlights` later restores, it sets the tile to hover intensity permanently even when the mouse has left. The `hoveredTile` skip guard at line 578 mitigates this for the *currently* hovered tile, but a tile that *was* hovered milliseconds before `updateTileHighlights` runs (and whose mouseleave event hasn't reset it yet) could still be captured with the wrong emissive.
**Fix:** Always snapshot from the tile type defaults (`TILE_EMISSIVE.base/wall/special`) instead of reading the live material state, since the defaults are deterministic.

### Finding 3: `currentStats` computed but unused in spec options (LOW)
**Location:** `game-board.component.ts:624`
**Risk:** `const currentStats = getEffectiveStats(this.selectedTowerInfo.type, this.selectedTowerInfo.level);` is computed but never referenced — the spec options now use `alphaStats`/`betaStats` directly. Dead variable. No runtime cost (tree-shaken in prod), but violates code quality standards and will trigger lint warnings.
**Fix:** Remove the unused `currentStats` line.

## Red Team Critique — feat/gameplay-interaction Pass 2 (2026-03-16)

### Finding 1: `repathAffectedEnemies` clears entire path cache even for single-tile repath (HIGH)
**Location:** `enemy.service.ts:912`
**Risk:** `this.clearPathCache()` wipes ALL cached paths on every tower place/sell. Enemies spawning later must recompute A* from scratch even if the board change was irrelevant to their spawn→exit route. On large boards with frequent tower activity, this creates unnecessary A* overhead. More importantly, the cache clear means the `findPath` calls inside the loop will each cache their result — but enemies at different grid positions will each trigger a fresh A* that could have been served from a still-valid cache entry.
**Fix:** Don't clear the global cache. Instead, only invalidate cache entries that include the blocked tile in their path. Or simpler: don't clear cache at all — `findPath` already handles blocked tiles via the board state; the cache key includes start/end positions, not board state, so stale entries would produce wrong results. The real fix is to always clear the cache (current behavior is correct but wasteful).

### Finding 2: Sell repath misses enemies that would benefit from the freed tile (MEDIUM)
**Location:** `game-board.component.ts:779`
**Risk:** When a tower is sold, `repathAffectedEnemies(row, col)` only repaths enemies whose path crossed the sold tower's position. But enemies routing AROUND the tower (via longer detour) would benefit from a shorter path through the now-free tile. These enemies continue on their longer detour unnecessarily. In a sell-and-replace scenario, enemies take suboptimal paths after the sell.
**Fix:** On tower sell, repath ALL ground enemies (not just affected ones) since any enemy could potentially take a shorter path. Use `repathAffectedEnemies(-1, -1)` for sell operations.

### Finding 3: `interpolateHeatmap` direction vector computed from grid nodes, not enemy world position (LOW — verified safe)
**Location:** `enemy.service.ts:185-189`
**Risk:** After repath with `pathIndex=0`, the direction vector points from path[0]→path[1]. If the enemy is physically between old nodes A and B, this direction may not match the enemy's current heading. However, `distanceToNext` uses the enemy's actual world position (line 194-197), so the snap-or-move logic works correctly regardless of the direction vector's semantic accuracy. The enemy may briefly face the "wrong" way for one tick before snapping. Verified safe — not a gameplay bug.
**Fix:** None needed. Document the behavior inline.

## Deployment Checklist — feat/gameplay-interaction
- [x] Step 1: Convention check — grep for console.log, TODO/FIXME/HACK, catch(e), hardcoded numbers added on this branch
- [x] Step 2: Tile-specific cost shown in mode indicator on hover (hoveredTileCost + gold display)
- [x] Step 3: Full test suite green (1839/1839 hard gate)
- [x] Step 4: Production build passes — CSS trimmed to 39.83kb (below 40kb error budget)
- [x] Step 5: Push to remote + update PR (#23)

## Red Team Critique — 2026-03-15 (Pricing System v2)

### Finding 1: Heatmap gradient extrapolation for strategic values > 0.75 (CRITICAL)
**Location:** `game-board.component.ts:661` (`interpolateHeatmap`)
**Risk:** Sprint 5 retuned `HEATMAP_GRADIENT` stops to end at 0.75, but `interpolateHeatmap()` clamps its input to `Math.min(1, value)`. The first-pass strategic computation (`computeStrategicValues`) caps values at `Math.min(1, ...)`, not 0.75. A choke tile that disconnects the path (bfsDelta=1.0) near a spawner can reach strategic value ~0.93 without any nearby towers. When this value enters `interpolateHeatmap()`:
- The bracket-finding loop fails (no adjacent stops span > 0.75)
- Falls back to `lower=stops[0]` (0.00), `upper=stops[4]` (0.75)
- Computes `t = (0.93 - 0.00) / 0.75 = 1.24` — extrapolation
- RGB channels exceed 1.0, producing incorrect bright/white tiles
**Fix:** Clamp interpolation input to the last gradient stop value: `Math.min(stops[stops.length - 1][0], value)` instead of `Math.min(1, value)`. Values > 0.75 render as the hottest color (red) rather than extrapolating.

### Finding 2: Dead "Inspect" code path in mode indicator (LOW)
**Location:** `game-board.component.html:364-366`
**Risk:** Sprint 8 changed the mode indicator `*ngIf` to require `isPlaceMode`, but the inner content still has a ternary: `isPlaceMode ? tower : 'Inspect'`. Since the element is only rendered when `isPlaceMode` is true, the "Inspect" branch and `.inspect-mode` class can never activate. Dead code that wastes template evaluation and confuses readers.
**Fix:** Replace the ternary with the tower name directly. Remove `.inspect-mode` class binding and related CSS. Simplify the `aria-label` binding.

### Finding 3: `applyClusterBonuses` iterates and mutates same Map (LOW)
**Location:** `tile-pricing.service.ts:280-308` (`applyClusterBonuses`)
**Risk:** The method iterates `this.strategicCache` while calling `.set()` on existing keys. Per ES2015 Map spec, modifying an existing key during `for...of` is safe (no new entries added, iteration visits each key once in insertion order). However, the pattern is fragile — a future change that adds new cache entries during the loop would cause non-deterministic behavior. Not a bug today, but a maintenance hazard.
**Fix:** Defer — document the iteration safety invariant inline. If the method grows, refactor to collect updates in a separate array and apply after iteration.

## Deployment Checklist — Pricing System v2
- [x] Step 1: Remove dead code — `HEATMAP_COLORS` unused export (ui.constants.ts), `.inspect-mode` dead CSS (game-board.component.scss)
- [x] Step 2: Convention check — grep for console.log, TODO/FIXME/HACK, hardcoded numbers added on this branch
- [x] Step 3: Full test suite green (1925/1925 hard gate)
- [x] Step 4: Production build passes — CSS 39.42kb (below 40kb error budget)
- [x] Step 5: Push to remote (f1273cf..7f4b6ba)

## Red Team Critique — 2026-03-15 (Wave Panel + Tile Dimming)

### Finding 1: Double board iteration in updateTileHighlights (LOW)
**Location:** `game-board.component.ts:585-652` (`updateTileHighlights`)
**Risk:** Two full-board passes (affordable + unaffordable) each call `getTileTowerCost()` per tile. On a 15×15 board this is 450 iterations + cache lookups. Not a performance bug — cache hits are O(1) and the board size is small — but architecturally wasteful. A single pass branching on `canAfford` would halve the work.
**Fix:** Defer — not worth the churn. The method runs once per tower selection change, not per frame. Document as a future optimization if boards grow.

### Finding 2: Wave preview panel scroll blocked during SETUP (LOW)
**Location:** `game-board.component.scss:201` (`.wave-preview { pointer-events: none }`)
**Risk:** If a wave preview has many enemy types, `overflow-y: auto` + `pointer-events: none` prevents scrolling the list during SETUP. In practice, waves have 1–4 enemy types at ~1.5rem each, well under the 400px `max-height`. Not reachable with current wave definitions, but could surface if wave complexity grows.
**Fix:** Defer — add `pointer-events: auto` to `.wave-preview-list` only if scroll becomes necessary.

### Finding 3: No findings requiring immediate fix
All interaction paths verified: SETUP tower placement unblocked, wave-btn pointer-events correct, unaffordable tile hover shows cost in mode indicator, drag preview checks tile-specific affordability, initial heatmap renders on board load.

## Deployment Checklist — Wave Panel + Tile Dimming
- [x] Step 1: Convention check — console.log/warn (3 intentional repath warnings), no TODO/FIXME, no magic numbers
- [x] Step 2: Full test suite green (1925/1925)
- [x] Step 3: Production build passes — CSS 39.31kb (below 40kb error budget)
- [x] Step 4: Push to remote (00a8a94..f669dd1)

---

## Sprint History — feat/product-campaign (15 sprints, merged 2026-03-16)

- **Sprint 1:** Campaign data model + service — `CampaignLevel`, `CampaignProgress`, `CampaignService`, `/campaign` route, `CampaignModule`
- **Sprint 2:** Campaign level select UI — lock/unlock states, star ratings, progress bar, next-level navigation
- **Sprint 3:** Intro campaign maps 1–4 — First Light, The Bend, Serpentine, The Fork (10×10, single spawner)
- **Sprint 4:** Early campaign maps 5–8 — Twin Gates, Open Ground, The Narrows, Crystal Maze (10×10–12×12, dual spawner)
- **Sprint 5:** Mid campaign maps 9–12 — Crossfire, The Spiral, Siege, Labyrinth (12×12–15×15, 2–3 spawners)
- **Sprint 6:** Late/endgame campaign maps 13–16 — Fortress, Gauntlet, Storm, Novarise (15×15–20×20, 2–4 spawners)
- **Sprint 7:** Custom wave definitions per map — `campaign-waves.ts` with 6–12 waves per level, tier-appropriate enemy rosters, `CampaignMapService` bridge
- **Sprint 8:** Enhanced endless mode — 7 wave templates, boss milestones at waves 5/10/15/20, score streaks, `endless-wave.model.ts`
- **Sprint 9:** Tutorial system — 5-step onboarding overlay, localStorage persistence, `TutorialService` injected into `GameBoardComponent`
- **Sprint 10:** Enemy encyclopedia + wave preview enhancement — `EnemyInfo` model, E-key panel toggle, NEW badges for first-encounter enemies in wave preview
- **Sprint 11:** Per-map challenge modes — 32 challenges across 16 maps, 6 `ChallengeType` variants (NoDamage, SpeedRun, LimitedTowers, GoldEfficiency, PerfectWaves, NoSlow), `ChallengeEvaluatorService`
- **Sprint 12:** Achievement expansion — 8 → 26 achievements across 4 categories (Combat, Campaign, Endless, Challenge), profile UI updated
- **Sprint 13:** Balance verification — 69 test assertions in `balance.spec.ts` codifying game economics across all campaign maps
- **Sprint 14:** Campaign integration polish — next-level flow, completion state, progress display on landing page
- **Sprint 15:** Documentation + final verification — ARCHITECTURE.md and STRATEGIC_AUDIT.md updated, full test suite verified
- **Test count:** 1835 → 2600+ tests

---

## Red Team Critique — 2026-03-16

### Finding 1: `recordMapScore` silently drops best stars on score regression (HIGH)
**Location:** `player-profile.service.ts:413-425`
**Risk:** A player 3-stars a map on replay with a slightly lower score. The entire update is skipped because the gate is `score > existing.bestScore`. The `Math.max(stars, existing.bestStars)` on line 419 only fires when the score gate passes. The 3-star result is permanently lost. This directly breaks the star-gated campaign unlock system (levels 9, 13, 15 require 12/24/30 total stars). A player could earn 3 stars repeatedly and never have them counted.
**Fix:** Split the update into two independent checks: update `bestScore` when score improves, update `bestStars` when stars improve. Both can fire independently. Save once if either changed.

### Finding 2: `challenger_all` achievement threshold is 16 but there are 41 challenges (MEDIUM)
**Location:** `player-profile.service.ts:304-310`
**Risk:** `condition: (p) => p.completedChallengeCount >= ALL_CAMPAIGN_MAP_COUNT` uses `ALL_CAMPAIGN_MAP_COUNT = 16`. But `CAMPAIGN_CHALLENGES` defines 41 total challenges across 16 maps. The "Challenge Master: Complete all challenges" achievement fires at 39% completion. Additionally, `completedChallengeCount` increments on every `recordChallengeCompleted()` call with no deduplication — completing the same challenge twice counts double.
**Fix:** Replace threshold with actual challenge count from `CAMPAIGN_CHALLENGES`. Add dedup guard using a `Set<string>` of completed challenge IDs instead of a raw counter.

### Finding 3: `countThreeStarMaps` counts non-campaign maps toward "Flawless" achievement (MEDIUM)
**Location:** `player-profile.service.ts:114-116, 231-233`
**Risk:** `countThreeStarMaps` iterates all `mapScores`, not just campaign maps. A player who 1-stars all 16 campaign levels and 3-stars 16 custom/freeplay maps satisfies the "Flawless" achievement without 3-starring any campaign map. The adjacent `totalCampaignStars` function already correctly filters by `mapId.startsWith('campaign_')`.
**Fix:** Add a `countThreeStarCampaignMaps` function that filters by campaign prefix, use it in the `three_star_all` condition.

---

## Sprint History — feat/product-campaign tech debt (16 sprints, 2026-03-16)

### Phase 1: God Component Extraction (Sprints 1-4 + Keystone 5)
- S1: GameEndService — unified 3 recording paths, -141 lines from component
- S2: ChallengeTrackingService — moved 3 challenge tracking fields
- S3: GameSessionService — wrapped restart + campaign wave orchestration
- S4: Deduplicated 3 method pairs + extracted shared importBoard()
- Keystone 5: Component 2892→2714 (-178)

### Phase 2: Oversized Service Breakdown (Sprints 6-9 + Keystone 10)
- S6: PathfindingService from EnemyService (1007→803)
- S7: CombatVFXService from TowerCombatService (898→783)
- S8: Achievement model from PlayerProfileService (536→257)
- S9: AudioService decoupled from SettingsService + TowerCombatService
- Keystone 10: All service LOCs verified

### Phase 3: DI & Lifecycle Fixes (Sprints 11-14 + Keystone 15)
- S11: Editor services scoped to EditorModule (no more root leaks)
- S12: TutorialService resetCurrentStep() on game restart
- S13: Modifier propagation centralized (services read from GameStateService)
- S14: Gold/score separation (sell refund no longer inflates score)

### Phase 4: Scene & Interaction Extraction (Sprints 16-17 + Keystone 19)
- S16: SceneService — Three.js infrastructure extracted (459 LOC)
- S17: TowerInteractionService — place/sell/upgrade business logic (252 LOC)
- Keystone 19: Component 2892→2314 (-578), 8 new services, 3024 tests

Test count: 2756 → 3024 (+268 tests)

---

## Red Team Critique — 2026-03-16 (Tech Debt Extractions)

### Finding 1: `slowApplicationCount` not reset on game restart — cross-session stat inflation (MEDIUM)
**Location:** `status-effect.service.ts:210`, `game-session.service.ts:38-47`
**Risk:** `StatusEffectService.slowApplicationCount` survives `resetAllServices()` because StatusEffectService is not reset by GameSessionService. `cleanup()` is called inside `TowerCombatService.cleanup()` which runs via the component's `cleanupGameObjects()`, NOT through GameSessionService. On game restart, slow applications from run 1 accumulate into run 2's achievement tracking. The `slow_and_steady` achievement (1000 applications) fires early across sessions.
**Fix:** Add `this.statusEffectService.cleanup()` to `GameSessionService.resetAllServices()`, or ensure `slowApplicationCount` is reset to 0 in the existing `cleanup()` method. Verify `cleanup()` zeroes the counter.

### Finding 2: `completeWave()` and `awardInterest()` bypass `addGoldAndScore()` — inline mutation (LOW — PARTIALLY FIXED in hardening-vi S13)
**Location:** `game-state.service.ts:completeWave()`, `awardInterest()`
**Risk:** Both methods directly mutate `state.gold += amount; state.score += amount` instead of calling `addGoldAndScore()`. If `addGoldAndScore()` ever gains side effects (audit log, modifier cap, event emission), these two paths silently bypass them. No bug today, but a future maintenance trap.
**Fix:** Refactor both methods to call `addGoldAndScore(amount)` instead of inline mutation.
**Status:** `addStreakBonus` (the real bypass in the streak path) was routed through `addGoldAndScore()` in S13. `completeWave()`/`awardInterest()` inline mutations remain.

### Finding 3: `TowerInteractionService.wouldBlockPath()` doesn't actually check path blocking (LOW)
**Location:** `tower-interaction.service.ts:115-124`
**Risk:** Method checks tile type/occupancy, not path-blocking BFS. The component uses it to decide whether to show the "path blocked" warning. For tiles that fail `canPlaceTower()` due to actual path blocking, the warning may not fire if the tile also fails the occupancy check first. The method name is misleading.
**Fix:** Either rename to `isValidEmptyTile()` or replace with a call to `GameBoardService.wouldBlockPath()`.

---

## Deployment Checklist

- [x] Step 1: Convention check — console.log/warn (0 new), no TODO/FIXME, no magic numbers in new files
- [x] Step 2: Full test suite green (3027/3027)
- [x] Step 3: Production build passes — CSS 35.82kb (below 40kb error budget)
- [x] Step 4: Push to remote and update PR #24

---

## Red Team Critique — 2026-03-16 (Tutorial Spotlight)

### Finding 1: `tutorial-target-highlight` uses `!important` on outline — stomps focus-visible rings (MEDIUM — FIXED in hardening-vi S18)
**Location:** `styles.css` — `.tutorial-target-highlight` rule
**Risk:** `outline: 3px solid ... !important` overrides `:focus-visible` outlines on the highlighted element. During the SELECT_TOWER step, if a keyboard user tabs to a tower button within `.tower-selection`, their focus ring is invisible because the tutorial highlight outline takes precedence. When the highlight is removed (step advance), the focus ring returns — but during that step, keyboard users lose their primary navigation cue.
**Fix:** Use `box-shadow` for the tutorial highlight instead of `outline`, leaving `outline` free for focus-visible. Or scope the `!important` to only apply when `:not(:focus-visible)`.

### Finding 2: `applyTutorialHighlight` uses raw `document.querySelector` — Angular anti-pattern (LOW)
**Location:** `game-board.component.ts:1748`
**Risk:** Queries the global DOM, not the component's view. If another component on the page has a matching selector (unlikely since routes are exclusive, but possible during transitions), the wrong element gets highlighted. Also makes the component harder to test in isolation — tests must append mock elements to `document.body`.
**Fix:** Acceptable trade-off. `@ViewChild` can't target dynamically-determined selectors. Document the limitation inline.

### Finding 3: Campaign scroll fix depends on parent flex context (LOW — PARTIALLY FIXED in hardening-vi S18)
**Location:** `campaign.component.scss:10`, `styles.css:208-212`
**Risk:** `height: 100%` on `.campaign-container` requires the parent (`app-campaign`) to have a constrained height. The fix added `app-campaign { flex: 1; overflow: hidden; }` which works IF the app root is a flex column. If the app layout changes (e.g., a wrapping div is added), the scroll breaks silently.
**Fix:** Add a comment documenting the flex chain dependency. Consider `height: 100vh` as a more robust fallback.
**Status:** dvh fallback added in S18, but flex-chain dependency still exists — fully robust solution deferred.

---

## Red Team Critique — 2026-03-17 (feat/hardening-v)

### Finding 1: EditorSceneService.dispose() does not dispose shadow map render targets (HIGH)
**Location:** `editor-scene.service.ts:387-444`
**Risk:** `initLights()` creates 2 DirectionalLights with `castShadow = true` (lines 229, 257). Shadow maps allocate WebGL render target textures. `dispose()` does not call `light.shadow.map?.dispose()` before removing lights. Over repeated editor open/close cycles (route transitions), shadow map textures leak. The game's `SceneService.disposeLights()` (scene.service.ts:362-363) correctly disposes shadow maps — the editor service was extracted without this pattern.
**Fix:** Add shadow map disposal for all shadow-casting lights before renderer.dispose(). Track lights as fields (like game's SceneService) or traverse scene for lights. Also null out scene/camera/renderer after disposal to prevent use-after-dispose.

### Finding 2: StorageService.setJSON() QuotaExceededError detection is browser-specific (LOW — FIXED in hardening-vi S16)
**Location:** `storage.service.ts:39`
**Risk:** `e.name === 'QuotaExceededError'` works on Chrome/Firefox/modern Safari but older Safari/WebKit used `e.code === 22` without the standardized name. The function still returns `false` on any exception (correct), but the descriptive error log is lost on affected browsers. Not a data-loss risk but reduces debuggability.
**Fix:** Add fallback check: `(e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22))`.

### Finding 3: CombatFrameResult.kills returns reference to reused array (LOW — FIXED in hardening-vi S14)
**Location:** `combat-loop.service.ts:214`
**Risk:** `this.frameKills` is cleared at the start of each `tick()` (line 87) and the same array reference is returned in the result (line 214). If a consumer stores the reference and reads it after the next `tick()`, it sees corrupted data. Currently safe because the component consumes synchronously in `processCombatResult()` (same animation frame), but fragile to future refactoring.
**Fix:** Defensive copy (`[...this.frameKills]`) returned in CombatFrameResult — allocation cost is negligible per frame.

---

## Deployment Checklist — feat/hardening-v

- [x] Step 1: Document CombatFrameResult.kills synchronous-consumption contract in combat-loop.service.ts
- [x] Step 2: Add file.size guard to MapStorageService.promptFileImport() (red-team lesson #148 still open)
- [x] Step 3: Final full test suite + production build — zero failures, zero warnings
- [x] Step 4: Push to remote and update branch for PR

---

## Sprint History — feat/hardening-vi (main, 2026-03-17)

**18 sprints — 3221 → 3496 tests (+275)**

| Sprint | Focus | Key Changes |
|--------|-------|-------------|
| S1 | State integrity | saveMap returns null on failure, modifier divergence fix, notification timeout leak, restart resets |
| S2 | Type safety | GlobalErrorHandler, CombatAudioEvent discriminated union, touches guard, subscription error handlers, FLYING enum case |
| S3 | Service extraction | TileHighlightService (204 LOC from component) |
| S4 | Service extraction | TowerAnimationService (81 LOC), SceneService.tickAmbientVisuals() |
| S5 | **KEYSTONE 1** | Test gaps: map-helpers (39 tests), applyCampaignWaves all 16 maps (50 tests), canLeaveGame (pre-existing) |
| S6 | Service extraction | RangeVisualizationService (135 LOC from component) |
| S7 | Service split | TowerMeshFactory (300 LOC from GameBoardService) |
| S8 | DESCOPED | ProjectileService extraction deferred — tightly coupled to combat |
| S9 | State migration | leakedThisWave → CombatLoopService, seenEnemyTypes → WaveService, legacy schema → MapBridgeService |
| S10 | **KEYSTONE 2** | 3456/3456, component 2256→1954 LOC, GameBoardService 708→432 LOC |
| S11 | Map integrity | Validate-before-save, post-migration validation, stale bridge on delete |
| S12 | Enum hardening | TargetingMode enum, assertNever utility, exhaustive switches |
| S13 | Gold consolidation | addStreakBonus routed through addGoldAndScore |
| S14 | Service hardening | PlayerProfile idempotency guard, WaveService cache, CombatFrameResult defensive copies |
| S15 | **KEYSTONE 3** | 3473/3473, 36 services (was 31), zero circular deps |
| S16 | Storage | Safari/Firefox QuotaExceeded detection, isAvailable() health check |
| S17 | Test quality | MORTAR BURN DoT e2e, CHAIN damage falloff, pause behavior, SpatialGrid query |
| S18 | Tutorial UX | TutorialSpotlightComponent extracted, box-shadow replaces outline !important, dvh scroll fallback |

---

### Sprints 19-28 (hardening-vi continued, 2026-03-17)
**10 sprints — 3496 → 3609 tests (+113)**

| Sprint | Focus | Key Changes |
|--------|-------|-------------|
| S19 | Editor UX | EditorNotificationService replaces 9 alert() calls with inline toasts |
| S20 | Performance | Raycasting array caching — eliminates per-mousemove Array.from() allocation |
| S21 | Test infra | 8 new spy factories in test-spies.factory.ts, component spec refactored |
| S22 | Dead code | Empty addHelpers removed, @deprecated aliases cleaned, rectangle magic number fixed |
| S23 | **KEYSTONE 5** | 3515/3515, zero tsc errors |
| S24 | Template | GameHudComponent extracted (10 tests) |
| S25 | Template | GameSetupPanelComponent extracted (14 tests) |
| S26 | Template | GameResultsOverlayComponent extracted (30 tests) |
| S27 | Template | TowerInfoPanelComponent extracted (9+ tests) |
| S28 | **KEYSTONE 6** | 3609/3609, template 573→387 LOC, 5 child components |

## Red Team Critique — 2026-03-17

### Finding 1: validateMapData accepts structurally invalid spawn/exit points (HIGH)
**Location:** `games/novarise/core/map-schema.ts:119-125`
**Risk:** `spawnPoints: [{}]` or `[{x: 9999, z: -1}]` passes all validation, gets saved, and produces a board with no SPAWNER tile. A* pathfinding crashes on wave start with no valid path. Exploitable via crafted JSON import.
**Fix:** Add type checks on spawn/exit point objects (must have numeric `x`/`z` fields) and coordinate-bounds checks (`0 <= x < gridSize`, `0 <= z < gridSize`).

### Finding 2: TowerMeshFactory shared materials cause double-dispose (MEDIUM)
**Location:** `services/tower-mesh-factory.service.ts:41-68` + `game-board.component.ts:1063-1067`
**Risk:** All meshes within a tower type share one material instance. `cleanupGameObjects` traverses each child and calls `disposeMaterial()`, disposing the same GPU resource multiple times. Three.js tolerates this (subsequent dispose() calls are no-ops) but it's technically incorrect, produces console noise in debug builds, and is fragile if Three.js ever tightens disposal semantics.
**Fix:** Clone material per mesh, or track disposed materials in a Set to skip duplicates during cleanup.

### Finding 3: Particle Y positions accumulate unboundedly in tickAmbientVisuals (MEDIUM)
**Location:** `services/scene.service.ts:340`
**Risk:** `positions[i+1] += Math.sin(...)` accumulates drift. After ~14 minutes at 60fps, particles have drifted ~100 units and are invisible. Visual regression in long sessions.
**Fix:** Store base Y positions at init time. Compute `baseY + sin(t)` instead of `+= sin(t)`.

### Finding 4: bind(this) in template creates new function every CD cycle (LOW)
**Location:** `game-board.component.html:61,164`
**Risk:** `.bind(this)` creates a new function reference on every change detection cycle, defeating OnPush optimization and forcing child re-renders at 60Hz during combat. GC churn.
**Fix:** Define bound functions as class field arrow functions: `isChallengeCompletedBound = (c: ChallengeDefinition) => this.isChallengeCompleted(c);`

---

## Red Team Critique — 2026-03-18 (Hardening VII, 30 sprints)

### Finding 1: restartGame() does not clear wave transition timers (HIGH)
**Location:** `game-board.component.ts:1230-1255`
**Risk:** If a player restarts during the 2-second "Wave Clear!" banner timeout, `showWaveClear` is never reset and `waveClearTimerId` is never cleared. The stale banner from the previous game bleeds into the new game's first wave, showing "Wave 5 Clear! Perfect!" during a fresh wave 1. Same issue with `waveStartPulseTimerId` — HUD pulse can trigger on stale timer. The `pathBlockedTimerId` IS correctly cleared (line 1252), making this an inconsistency the author missed.
**Fix:** Clear `waveClearTimerId`, `waveStartPulseTimerId` in `restartGame()`. Reset `showWaveClear`, `waveClearMessage`, `waveStartPulse` to defaults.

### Finding 2: Hit flash restoration overwrites emissive during death fade (MEDIUM)
**Location:** `enemy.service.ts:1025-1055`
**Risk:** `updateHitFlashes()` iterates ALL enemies including dying ones. If an enemy dies while mid-flash (120ms flash, 300ms death fade overlap), the flash expiry at line 1042-1043 restores the pre-flash emissive color, fighting the death animation's opacity fade. Visually, the dying enemy briefly shifts from white flash back to its status-effect color (e.g., BURN orange) during the death shrink — a noticeable visual pop. The guard in `startHitFlash()` (line 995: `if (enemy.dying) return`) prevents NEW flashes on dying enemies, but does NOT handle flashes that were already in progress when death started.
**Fix:** Add `if (enemy.dying) { enemy.hitFlashTimer = 0; return; }` at line 1029, immediately after the forEach entry. This cancels in-progress flashes on dying enemies without restoration, letting the death animation own the visual state cleanly.

### Finding 3: Reduce-motion class not applied on page load or navigation (MEDIUM)
**Location:** `profile.component.ts:68-75`
**Risk:** `loadSettings()` reads `reduceMotion` from `SettingsService` but never applies the `reduce-motion` class to `document.body`. Only `toggleReduceMotion()` (line 123) applies it. After page refresh or navigation back to `/profile`, the toggle shows "On" but animations still play — the accessibility override is silently broken. A user who explicitly opted out of motion will see animations until they toggle off and on again.
**Fix:** Add `if (this.reduceMotion) { document.body.classList.add('reduce-motion'); }` at the end of `loadSettings()`.

---

## Deployment Checklist
- [x] Step 1: Wire `.reduce-motion` CSS rules — the body class is set but no selectors consume it; duplicate each `@media (prefers-reduced-motion: reduce)` block as `.reduce-motion` selectors
- [x] Step 2: Wire `showFps` setting to game HUD — FPS counter is always visible; read `SettingsService.showFps` and conditionally show/hide
- [x] Step 3: Sync ARCHITECTURE.md with new files/services added in Hardening VII
- [x] Step 4: Final full test suite verification — 4028/4028 tests, zero failures, clean build ✓
