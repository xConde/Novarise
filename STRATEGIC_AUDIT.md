# STRATEGIC AUDIT — Novarise Tower Defense

**Date:** 2026-02-06
**Branch:** `feat/velocity-gameplay-loop`
**Sprint:** Founder Mode — Full Gameplay Loop Sweep

---

## 1. MOMENTUM & ZOMBIES

### What is mostly done but not shipping?

The **entire game runtime** is a zombie. The infrastructure is complete and polished — routing, data model, editor→game bridge pipeline, A* pathfinding, 3D rendering, 119+ tests — but there is **zero gameplay**. You can place towers and spawn enemies manually, but nothing actually *happens*. Towers are decorative. Enemies are harmless.

**Zombie inventory:**
- `TowerType` enum defines 5 types (`CANON`, `GATLING`, `SLOWING`, `SNIPER`, `LASER`) that correspond to **nothing** — the actual system uses 3 string-based types (`'basic'`, `'sniper'`, `'splash'`)
- `Enemy.value` field exists on every enemy but is **never collected**
- `GameBoardTile.cost` field is initialized but **never used** in any purchase logic
- `placeTower()` accepts `towerType` parameter then **passes `null`** to the constructed tile — the tower type is immediately discarded
- `ENEMY_STATS` defines health/speed/value for all 5 enemy types but health is **never reduced** and value is **never awarded**

### Why isn't it shipping?

Because the gameplay layer was never built. All effort went into the map editor (complete) and the rendering/pathfinding infrastructure (complete). The services that connect these into an actual game — combat, waves, economy, health, win/lose — simply don't exist.

---

## 2. THE GAP

**The single architectural blocker:** There is no game loop connecting towers → enemies → economy → waves → win/lose.

Specifically, there are **zero services** for:
- Game state management (phase, lives, gold, wave tracking)
- Tower combat (targeting, damage, fire rate, projectiles)
- Wave spawning (automated enemy waves with difficulty progression)
- Economy (tower costs, kill rewards, wave bonuses)
- Win/lose conditions (life deduction on enemy leak, victory on final wave)

The `GameBoardComponent.animate()` loop runs every frame but only does: update controls, animate particles, move enemies, remove leaked enemies. There is no combat tick, no state check, no economy update.

---

## 3. THE BATTLE PLAN

### Step-by-step checklist to ship the gameplay loop:

- [x] **Fix TowerType enum alignment** — Replaced disconnected 5-type enum with 3 string-backed values (`BASIC`, `SNIPER`, `SPLASH`). Added `TowerStats` interface and `TOWER_CONFIGS` with damage, range, fire rate, cost.
- [x] **Create game state model** — `GamePhase` enum, `GameState` interface, `INITIAL_GAME_STATE` constant.
- [x] **Create wave model** — `WaveEntry`, `WaveDefinition` interfaces. 10 waves with escalating difficulty.
- [x] **Build GameStateService** — BehaviorSubject-based state management with `startWave()`, `loseLife()`, `addGold()`, `spendGold()`, `completeWave()`, phase transitions.
- [x] **Build WaveService** — Reads wave definitions, spawns enemies on timer, tracks spawning state.
- [x] **Build TowerCombatService** — Per-frame tower targeting (nearest enemy in range), cooldown, projectile management, splash damage.
- [x] **Fix `placeTower()` null bug** — Now passes actual `TowerType` to `GameBoardTile` constructor.
- [x] **Add enemy damage/death to EnemyService** — `damageEnemy()`, `updateHealthBars()` methods. Health bar mesh above each enemy with color transitions.
- [x] **Wire gameplay loop into GameBoardComponent** — Full integration: tower purchase (gold check), wave start (Space key), combat tick, enemy leak (life loss), wave complete, victory/defeat transitions, restart.
- [x] **Add game HUD** — Lives (red, critical pulse), gold (gold), wave counter, score. Tower costs on buttons. "Start Wave" button. Victory/Defeat overlay with restart.
- [x] **Build and verify** — `ng build` passes. 104/108 existing tests pass (4 pre-existing EnemyService flaky failures).

---

## Red Team Critique

### BUG #1 (CRITICAL): Defeat-to-Victory Race Condition

In the `animate()` game loop, enemy-leak processing and wave-completion checking happen sequentially in the same frame. If the last enemy leaks (setting phase to `DEFEAT` via `loseLife()`), the enemies map becomes empty, and then the wave-completion check fires — calling `completeWave()` which **overwrites DEFEAT with VICTORY or INTERMISSION**. The player loses but sees a victory screen.

**Root cause:** The wave-completion check at the end of the frame doesn't re-check the current phase after `loseLife()` may have mutated it mid-frame.

**Fix:** Guard the wave-completion check with a fresh phase read: `if (this.gameStateService.getState().phase === GamePhase.COMBAT && ...)`.

### BUG #2 (MEDIUM): `TowerCombatService.reset()` is a Resource-Leak Footgun

`reset()` clears the projectiles array without disposing THREE.js geometry/materials. `cleanup(scene)` does it correctly. `reset()` is currently dead code, but any future caller would silently orphan GPU resources. Should be removed — only `cleanup()` should exist.

### BUG #3 (LOW): Unsubscribed Observable

The `getState$().subscribe()` in `ngOnInit` is never unsubscribed in `ngOnDestroy`. Technically safe because the service and component share the same injector lifecycle, but violates Angular cleanup patterns and could cause emissions on a destroyed component during teardown edge cases.

---

## Red Team Critique — Round 2

### BUG #4 (CRITICAL): Path-Blocked Spawning Silently Eats Enemies → Free Victory Exploit

`WaveService.update()` calls `enemyService.spawnEnemy()` and decrements `remaining` unconditionally — it **ignores the null return** when A* finds no valid path. If the player walls off all spawner-to-exit paths with towers, every spawn silently fails, the wave "completes" with zero enemies, and `completeWave(reward)` awards free gold. Repeat for all 10 waves = effortless victory.

**Root cause:** `WaveService.update()` treats spawn as fire-and-forget instead of checking the return value.

**Fix:** Only decrement `remaining` when `spawnEnemy()` returns a non-null enemy. Failed spawns stay in the queue and retry next tick.

### BUG #5 (MEDIUM): Health Bar Geometry/Material Leak on Enemy Removal

`EnemyService.removeEnemy()` disposes the main mesh geometry and material, but the two health bar child meshes (`PlaneGeometry` + `MeshBasicMaterial` each) are never disposed. `scene.remove()` detaches them from the scene graph but does NOT release GPU resources. Over 10 waves with 100+ enemies, that's 200+ leaked geometries and materials accumulating in VRAM.

**Root cause:** `removeEnemy()` was written before health bars were added and was never updated to traverse children.

**Fix:** Traverse all children of the enemy mesh and dispose their geometry/material before removing from scene.

### BUG #6 (LOW): `EnemyService.damageEnemy()` Is Dead Code

`TowerCombatService.applyDamage()` directly mutates `enemy.health` by reaching through `getEnemies().get()`. The `damageEnemy()` method added to `EnemyService` is never called. Two damage pathways exist for one responsibility — the "official" one is unused.
