# Strategic Audit — 2026-03-03

## Current State

**Stack:** Angular 15 + Three.js | 1332/1332 tests passing | Karma + headless Chrome
**Two systems:** Map Editor (`/edit`) + Tower Defense Game (`/play`), lazy-loaded
**Core loop:** 3 tower types, 5 enemy types, 10 waves, economy, upgrade/sell, A* pathfinding, victory/defeat
**Visuals:** Bloom, vignette, skybox, particles, custom tower meshes, health bars
**Editor:** 4 terrain types, brush/fill/rectangle tools, undo/redo, save/load/export, mobile joystick

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

## Deployment Checklist — feat/visual-overhaul (Closer Pass 2)
- [x] Fix red team pass 2 Finding 1: Pre-allocate trail BufferGeometry, update in-place
- [x] Fix red team pass 2 Finding 2: Share impact flash SphereGeometry across all flashes
- [x] Remove redundant ambient light (hemisphere provides ambient fill)
- [x] Fix tower placement BFS for corner spawners (flood-fill spawner group)
- [x] Fix minimap dimensions for rectangular boards (gridWidth/gridHeight)
- [x] Full test suite green (1697/1697)
- [x] Push to PR
