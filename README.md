# Novarise

A tower defense game built with Angular 15 and Three.js. Design custom maps in a 3D editor, then defend them with upgradeable towers against waves of enemies.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/edit` | 3D map editor — paint terrain, set spawn/exit, save/load maps |
| `/maps` | Map select — pick a map or quick play |
| `/play` | Tower defense game (requires map or quick play) |

## Stack

- **Framework:** Angular 15
- **3D Engine:** Three.js (post-processing: bloom, vignette)
- **Tests:** Karma + Jasmine (1771 specs)
- **Deploy:** Cloudflare Pages

## Development

```bash
npm install
ng serve          # http://localhost:4200
npm test          # Run test suite (headless Chrome)
ng build          # Production build → dist/
```

## Game Features

- 6 tower types with L3 specialization branching (Basic, Sniper, Splash, Slow, Chain, Mortar)
- 8 enemy types including flying enemies immune to slow
- 10 waves + endless mode, 4 difficulty levels
- 8 pre-game modifiers with score multipliers
- Tower targeting modes (nearest/first/strongest)
- Status effects: SLOW (Slow tower), BURN (Mortar, Chain Tesla L3), POISON (Splash Bombardier L3)
- Per-map best scores with star ratings on map select
- Interest system with visible wave income feedback
- Score breakdown, star rating, keyboard tower management (U/T/Del)
- WebGL context loss detection and auto-recovery
- Deterministic fixed-timestep physics (60Hz)

## Editor Features

- 4 terrain types, 3 brush tools (brush/fill/rectangle)
- Multi-spawn and multi-exit support (up to 4 each)
- Undo/redo, save/load, export/import
- Map templates (Classic, Maze, Spiral, Open Field)
- Real-time path validation
