# Novarise

A card-driven turn-based tower defense roguelite built with Angular 15 and Three.js.
Play a run across 3 acts and a final boss, building your deck and collecting relics as you go.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/edit` | 3D map editor — paint terrain, set spawn/exit, save/load maps |
| `/run` | Run hub — node map, deck inspection, relic overview, act progression |
| `/play` | Combat encounter (card play → end turn → combat resolution loop) |
| `/profile` | Player profile and run history |
| `/library` | Card and relic codex |

## Stack

- **Framework:** Angular 15
- **3D Engine:** Three.js (post-processing: bloom, vignette)
- **Tests:** Karma + Jasmine (see CI for current count)
- **Deploy:** Cloudflare Pages

## Run Loop

1. Start a run on the node map (`/run`)
2. Choose a path through branching nodes — Battles, Elite Battles, Shops, Rest Sites, and Events
3. In each combat encounter (`/play`): play cards from your hand to place towers or cast spells, then end your turn to let enemies advance and towers fire
4. Collect gold, draft new cards, and pick up relics between encounters
5. Clear 3 acts then defeat the Final Boss to complete your ascent

## Card Archetypes

| Archetype | Identity |
|-----------|----------|
| Cartographer | Terrain manipulation and path control |
| Highground | Elevation-based line-of-sight and range bonuses |
| Conduit | Tower graph linking for chain damage and buffs |
| Siegeworks | Deferred — planned for a future phase |

## Development

```bash
npm install
npm run dev       # http://localhost:3999
npm test          # Run test suite (headless Chrome)
ng build          # Production build → dist/
```

## Editor

- 4 terrain types, 3 brush tools (brush/fill/rectangle)
- Multi-spawn and multi-exit support
- Undo/redo, save/load, export/import
- Real-time path validation
