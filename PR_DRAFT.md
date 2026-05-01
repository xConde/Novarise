# PR Draft — feat/card-branding

**Target branch:** main
**Commits:** 38 ahead of main
**Test count:** 7736 SUCCESS / 0 FAILED / 1 skipped (+362 over inherited PR #35 baseline of 7374)
**Build:** clean

70-sprint UI/UX card branding overhaul across 8 phases. Cut from `main`
after PR #35 merge (commit 87b8a64). 0 spec regressions, 0 build failures
across the entire branch.

---

## TL;DR

Cards now carry a full identity system. Players can read a card's type
(silhouette), archetype (trim color + backdrop pattern + sub-icon),
keywords (icon badges + inline icons in description), and flavor at a
glance — across all 6 card surfaces (card-hand, pile-inspector,
card-draft, library tile, in-game card-detail modal, library
card-detail-modal).

Before this branch: every card looked like the same rectangle with a
type-color border. After: each archetype reads distinctly, each card
type has its own silhouette, and each keyword has a recognizable icon.

## Layered identity system (8 layers, 6 surfaces)

| Layer | What it conveys | Surfaces |
|---|---|---|
| Frame silhouette (clip-path) | Card type at-a-glance | hand, tile, draft |
| Archetype trim ring | Archetype faction | hand, pile, tile, modals |
| Archetype backdrop | Archetype theme texture | hand, tile, modals |
| Archetype sub-icon | Archetype reinforcement | hand, modals |
| Keyword badges | Active keywords | hand, modals |
| Inline {kw-*} icons | Keywords in flow text | tooltip, modals |
| Tower footprint | "This places a tower" | hand, tile, draft, modals |
| Flavor text | Personality / lore | tooltip, modals |

## Phase summary

| Phase | Sprints | Commits | Specs | What |
|---|---|---|---|---|
| A | S1-S8 | 5 | 0 | Foundation — tokens, naming, archetype required |
| B | S9-S18 | 9 | +37 | Frame silhouettes per card type |
| C | S19-S28 | 5 | +27 | Archetype trim color + backdrops |
| D | S29-S40 | 7 | +37 | 14-icon vocabulary + inline parser |
| E | S41-S48 | 3 | +13 | Tower footprint (rescoped from 8) |
| F | S49-S58 | 3 | +171 | Card-detail modal + cross-component spec |
| G | S59-S66 | 3 | +18 | flavorText field + 74 lines written |
| H | S67-S72 | 3 | 0 | Audits + reduce-motion bug fixes + close |

## Key design decisions

### Hue-distance audited archetype palette

Trim colors aren't theme-pure; they're picked to maximize distinguishability:

- Cartographer #4a9a72 (155° green-teal) — pulled from blue-teal toward
  green for 103° separation from Conduit (was 60° too close at low
  saturation on dark bg)
- Highground #b8724a (22° terracotta) — pushed from ochre toward red
  for 38° clearance from rare gold (was 24° fight)
- Conduit #7a6ab8 (258° pure violet)
- Neutral #7a7a88 (charcoal-silver) — brightened from #6a6a78 to survive
  on dark card bg

### `box-shadow: inset` for trim, `filter: drop-shadow` for rarity glow

Two different shadow APIs serving two different layers. Inset shadow
naturally clips to clip-path; drop-shadow follows the polygon outline.
They coexist on framed cards without fighting. Discovered when the
filter chain was already 2-deep and a third drop-shadow would have
pushed past the 4.4ms paint budget identified in S9.

### Frame silhouettes are SHAPE, not full-frame fill

Tower battlements / Spell peak / Modifier octagon / Utility chevron.
Color identity stays on the trim ring; backdrop pattern lives in the
art zone. A hand of 8 mixed-archetype cards doesn't look like a rainbow.

### Modals use art-zone strip, not clip-path

Both card-detail modals are wide vertical info panels, not card-shaped.
Forcing a polygon onto them would clip rounded corners and look broken.
Used a 3.5rem (in-game) / 2.5rem (library) art strip with backdrop
pattern + trim ring instead. Same identity signals, different geometry.

### Single creative pass for flavor

74 flavor lines written in one bundled agent call rather than 6 separate
sprints. Voice coherence preserved (military-industrial with sci-fi
accents per the Phase A naming-audit's tonal finding). Average 46.8 chars,
max 60 (well under 80 budget).

## Honest scope cuts

### Phase E rescoped 8 → 3 sprints

S44-S47 (modifier active-state chips on 3D towers) deferred outside
this branch. Those chips would have required CSS2DRenderer or Three.js
sprite positioning and lifecycle subscriptions to CardEffectService —
all game-state UX, not card branding. Belongs in a separate
`feat/board-status-chips` branch.

### Other deferrals

- Card-draft archetype trim/backdrop — no archetype wiring exists; refactor outside scope
- Pile-inspector backdrop pattern — illegible at row scale (deliberate skip)
- 3 flavor line revisions (CLIFFSIDE / COLLAPSE / GRAVITY_WELL) — minor
- Tower battlement readability at 3.75rem mobile — design call awaiting smoke
- Per-archetype radial gradient on modal art strips — Phase H polish
- Siegeworks archetype rendering — Phase 5 elsewhere

## Test plan

- [ ] `npm test` — confirm 7736 SUCCESS / 0 FAILED / 1 skipped
- [ ] `npm run build` — confirm clean
- [ ] Walk the browser-smoke checklist at
      `docs/cards/browser-smoke-checklist.md` (60+ items across 8 phases)
- [ ] Spot-check 3 flagged flavor lines (CLIFFSIDE / COLLAPSE /
      GRAVITY_WELL) for tone/clarity — revise if needed before merge
- [ ] Verify reduce-motion via OS toggle AND in-game settings — both
      paths now wired (S67-S70 fix)
- [ ] Eyeball decorative density on a Cartographer rare card with a
      keyword (worst case: CARTOGRAPHER_SEAL with all archetype layers
      stacked)

## Files changed

- 1 new component: `DescriptionTextComponent` (standalone, parses {kw-*}
  tokens, renders inline icons inline with text)
- 1 new SCSS partial: `_card-tokens.scss` (~140 tokens across 14 groups)
- 14 new SVG icons in IconRegistry (6 keyword + 4 archetype + refresh of 4 type)
- 1 new integration spec: `card-branding.integration.spec.ts` (152 specs
  guarding cross-surface binding consistency)
- 8 in-repo phase close docs + 1 branch close doc + 1 browser-smoke checklist

## Out of scope

- New cards (content)
- Balance changes
- New keywords / mechanics
- Audio
- 3D card meshes
- Foil/holographic effects
- i18n / translation hooks
- Modifier chips on towers (deferred branch)

## Documentation

Full permanent record at `docs/cards/card-branding-close.md`. Per-phase
close docs at `docs/cards/phase-{a,b,c,d,e,f,g,h}-close.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
