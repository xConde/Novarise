# Strategic Audit — 2026-03-03

## Current State

**Stack:** Angular 15 + Three.js | 579/579 tests passing | Karma + headless Chrome
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

**One real bug:**
- `novarise.component.ngOnDestroy()` never calls `terrainGrid.dispose()` — leaks 625 meshes on every `/edit` → `/play` navigation.

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

**"Repo aligned with tooling" milestone:** After S0A + S0B
**"Magic number debt cleared" milestone:** After S0C + S0D
**"Playable demo" milestone:** After S1 + S2 + S3
**"Show someone" milestone:** After S4
**"Ship it" milestone:** After S7 + S9

### Sprint 0C and 0D: Parallel or Sequential?

0C and 0D touch completely different files (game/ vs novarise/). They CAN run in parallel if using separate branches. But if you want to go slow and review each constants extraction carefully, run them sequentially. Either way, they both depend on 0B (the constants architecture must exist before you populate it).
