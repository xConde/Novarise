# Future Plans — Novarise Tower Defense

> Maintained as a living document. Items move to sprint branches when work begins.

## Backlog (Not Yet Started)

### Gameplay Features
- **Kill streak counter** — Track rapid kills within a time window, award bonus gold at thresholds (Triple Kill, Rampage, Unstoppable)
- **Tower active abilities** — Cooldown-based abilities per tower type (e.g., Sniper: called shot, Splash: carpet bomb)
- **Auto-tower placement mode** — Smart placement suggesting optimal tower positions based on path coverage
- **Boss mechanics** — Unique boss abilities per wave (shields, speed bursts, minion spawns)
- **Tower synergies** — Adjacent tower bonuses (e.g., Slow + Sniper = guaranteed crit)

### Game Design / UX
- **Sell confirmation redesign** — Replace double-click pattern with explicit modal or undo. Current pulsing red state reads as "error" not "confirm"
- **Tower placement undo** — Free undo immediately after placing (standard TD pattern). Currently requires sell at a loss
- **Wave preview threat indicators** — Show HP/speed per enemy type, not just composition. Useless until player memorizes roster
- **Difficulty as onboarding step** — Present as a focused first choice, not ambient UI competing with the board
- **Skip intermission button** — Let player fast-forward to next wave during INTERMISSION
- **"No gold" feedback** — Contextual message when player can't afford any tower and enemies are leaking
- **Tower icon differentiation** — Basic and Slow both use circles. Need distinct shapes
- **Map card metadata** — Show grid size or complexity indicator on map select cards
- **Fire rate label clarity** — "Rate: 0.5s" is ambiguous. Consider "Attack Speed" or "shots/sec"

### Editor Features
- **Template picker UI** — In-editor panel to browse and apply map templates
- **Symmetry tools** — Mirror/rotate brushes for balanced map design
- **Path validation** — Real-time BFS/DFS from spawn to exit, block invalid edits
- **Map delete/rename from UI** — Currently only API-level, needs buttons

### Progression
- **Campaign mode** — Ordered map sequence with unlockable towers
- **Achievement notifications** — Toast/popup when achievements unlock during gameplay
- **Leaderboard** — Per-map high scores with localStorage persistence

### Infrastructure
- **Angular upgrade** — 15 → 17+ (standalone components, signals)
- **PWA support** — Service worker, offline play, install prompt
- **Performance** — Object pooling for projectiles/particles, instanced meshes for enemies

### Mobile
- **Touch gameplay polish** — Pinch-zoom smoothing, drag-to-pan dead zone tuning
- **Responsive breakpoints** — Tower panel collapse on small screens

---

## Known Technical Debt

### Board Dimensions Hardcoded
`GameBoardService` hardcodes exit tile coordinates `[[9,11],[9,12],[10,11],[10,12]]` and spawner ranges for a 25x20 board. Imported maps of different sizes will have broken pathfinding. Needs `BOARD_CONFIG` with computed spawner/exit positions.

### Editor Disposal Leak
`novarise.component.ngOnDestroy()` never calls `terrainGrid.dispose()` — leaks 625 meshes on every `/edit` to `/play` navigation. One-liner fix but not on this branch.

### Perfectionist Achievement Pattern
Self-referential condition (`p.achievements.includes('perfectionist')`) works via manual injection before the condition loop. Fragile — should compute from game stats directly instead.

### Sphere Segment Counts
Enemy meshes use hardcoded segment counts (16 for normal, 12 for mini-swarm). Should be extracted to `ENEMY_MESH_CONFIG`.

### Audio Throttling Uses Wall Time
`AudioService` throttles enemy hit sounds with `Date.now()` instead of game-loop time. Throttle persists through pause/unpause transitions.

---

## Completed in Sprint Blitz (feat/sprint-blitz)

| Sprint | Features |
|--------|----------|
| S2 | Kill feedback particles, screen shake, gold popups, tower placement preview |
| S3 | Pause/resume (P), speed controls (1x/2x/3x), camera pan (WASD) |
| S4 | Difficulty modes, star rating, map select, endless mode |
| S5 | Slow Tower, Chain Lightning, Mortar, Shielded/Swarm enemies |
| S6 | Map templates, map sharing (URL export) |
| S7 | Responsive layout, touch controls |
| S8 | Player profiles, settings persistence, victory/defeat summary |
| S9 | FPS counter, minimap, hotkeys (1-6), performance monitoring |
| S10 | Health bar improvements, wave preview, tower upgrade VFX |
| S11 | Tooltip system, game timer, path visualization |
| S12 | Sound effects, minimap + damage popup integration |
| S13 | Flying enemy type |
| S14 | Game stats tracking |
| S15 | Wave counter HUD |
| S16 | Tower sell confirmation, range indicator toggle (R) |
| S17 | Keyboard shortcut help overlay (H) |
| S18 | Interest system (5% gold between waves) |
