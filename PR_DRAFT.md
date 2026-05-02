# PR Draft — feat/card-branding

**Target branch:** main
**Commits:** 55 ahead of main
**Test count:** 7763 SUCCESS / 0 FAILED / 1 skipped (+389 over inherited PR #35 baseline of 7374)
**Build:** clean
**Lint:** 0 in-scope warnings (2 pre-existing exempt warnings on `main` documented in prior PR's deployment checklist)
**Red team:** 1 HIGH (icon path parity drift) closed via 18 new parity specs in commit `f0c649a`. 1 MEDIUM (TowerThumbnailService silent failures) closed via gated console.warn. 1 LOW (SCSS pattern split) deferred with rationale. Full critique in `STRATEGIC_AUDIT.md`.

70-sprint UI/UX card branding overhaul (Phases A-H), then a 31-sprint
post-phase iteration round (S73-S101) that replaced the polygon clip-path
chrome with HUD-pair chip layout, built `TowerThumbnailService` for 3D
mesh thumbnails on tower cards, and shipped a 13-glyph hero-art vocabulary
for all 62 non-tower cards. Cut from `main` after PR #35 merge (commit
87b8a64). 0 spec regressions, 0 build failures across the entire branch.

---

## TL;DR

Cards now carry a full identity system across 5 surfaces (card-hand,
library tile, card-draft, in-game card-detail modal, library card-detail-
modal). Players can read a card's type (silhouette + chrome), archetype
(trim color + backdrop pattern + sub-icon), keywords (icon badges + inline
icons in description), flavor (lore line), AND **hero art** at a glance:

- Tower cards (12) show pixel-perfect 3D mesh thumbnails rendered live by
  `TowerThumbnailService` from each tower type's actual game model
- Non-tower cards (62) show one of 13 effect glyphs in a shared vocabulary
  (fx-damage / burn / poison / slow / heal / gold / draw / energy / buff /
  scout / recycle / link + reuse of kw-terraform for terraform spells)

Before this branch: every card looked like the same rectangle with a
type-color border. After: each archetype reads distinctly, each card type
has its own silhouette, and every individual card has a unique hero image.

## Layered identity system (9 layers, 5 surfaces)

| Layer | What it conveys | Surfaces |
|---|---|---|
| Hero art (3D thumbnail / effect glyph) | Per-card visual identity | hand, tile, draft, modals |
| Frame chrome (HUD-pair chips) | Cost / upgrade state | hand, tile, draft, modals |
| Archetype trim ring | Archetype faction | hand, pile, tile, modals |
| Archetype backdrop | Archetype theme texture | tile, modals |
| Archetype sub-icon | Archetype reinforcement | hand, modals |
| Keyword badges | Active keywords | hand, modals |
| Inline {kw-*} icons | Keywords in flow text | tooltip, modals |
| Tower footprint | "This places a tower" | tile, draft, modals |
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
| **Visual rescue** | **S73-S90** | **12** | **0** | **HUD-pair chrome + TowerThumbnailService** |
| **Glyph system** | **S91-S101** | **3** | **+9** | **13 hero glyphs for 62 non-tower cards** |

## Key design decisions

### Hue-distance audited archetype palette (Phase C)

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

### Hand-card chrome is HUD-pair, not polygon-frame (S73-S81)

The Phase B polygon clip-path frames read as "battle-damaged" at 7×9.5rem
hand scale — the angular cuts implied damage rather than identity. S73
stripped clip-paths from card-hand only (kept on library tile + card-draft
where they have room to breathe). S80-S81 replaced the cost pill + instance
dot with HUD-pair chips: cost top-right (square, gold when affordable),
upgrade `+` top-left (square, present only when upgraded). Reads as a
clean overlay, not damage.

### 3D thumbnails beat vector silhouettes for towers (S77-S90)

S77 attempted a flat SVG turret icon as tower hero art — rejected. A
generic vector turret reads as "any tower" not "this specific tower." The
in-game 3D meshes have distinct silhouettes (Sniper tripod, Mortar angled
cannon, Slow orb-on-rings, etc.) that no flat icon can match.

S79 built `TowerThumbnailService` (root-scoped, ~230 lines) to render
each `TowerType` to a 384×384 PNG data URL via an offscreen Three.js
renderer. Uses `TowerMeshFactoryService` directly (factory accepts
undefined registries via `@Optional`). Per-tower bounding-box
auto-framing (S87), 90° Y rotation for action-shot side profile (S86),
3-point lighting (S89), centered lookAt (S90). Cached per `TowerType`
in a Map; rebuilds on hard refresh. ~40-50kb per cached PNG.

### 13-glyph effect vocabulary for non-tower cards (S91-S101)

The 3D thumbnail pipeline doesn't generalize to spells/modifiers/utilities
because they have no 3D model. S91-S97 shipped an iconographic system: 11
new fx-* glyphs (damage, burn, poison, slow, heal, gold, draw, energy,
buff, scout, recycle) in the same design language as the existing kw-* and
arch-* icons (24×24 viewBox, strokeWidth 1.5, currentColor). Plus reuse of
kw-terraform / kw-link as hero glyphs for archetype-effect cards (Lay Tile,
terraform spells).

`CardDefinition.effectGlyph` accepts a single name OR a 2-tuple
`[primary, secondary]` for composed effects (Cryo Pulse `[fx-slow,
fx-draw]`, Chain Lightning `[fx-damage, fx-link]`, Conduit Bridge
`[fx-link, fx-buff]`). Primary renders at hero size (40-64px depending on
surface), secondary as a small bottom-right circular accent. Color tints
via per-card-type accent variables (cyan/purple/green for spell/modifier/
utility).

S98-S101 iterated 3 glyphs based on hero-scale smoke testing:
- **fx-damage** corner ticks → 8-point asterisk burst (clearer "strike")
- **fx-link** added (hub + 4 satellites) for hero scale; kw-link kept
  unchanged for the 14px keyword badges. Splits scale-specific concerns.
- **fx-gold** stacked ellipses → stacked rectangular gold bars (reads as
  "ingots / treasure" not "abstract discs")
- **fx-scout** generic eye → magnifying glass (specifically "examine
  ahead", matches the SCOUT_AHEAD/ELITE mechanic)

Coverage spec asserts every non-tower card has a glyph, every glyph name
is registered, and 2-tuple glyphs never duplicate.

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

- [ ] `npm test` — confirm 7745 SUCCESS / 0 FAILED / 1 skipped
- [ ] `npm run build` — confirm clean
- [ ] Walk the browser-smoke checklist at
      `docs/cards/browser-smoke-checklist.md` (60+ items across Phases A-H)
- [ ] Verify all 6 tower thumbnails render correctly (basic / sniper /
      splash / slow / chain / mortar) — temp-deck override pattern in
      `project_card_branding_handoff.md` if needed
- [ ] Verify all 13 non-tower hero glyphs render at hand / tile / draft /
      modal scales — temp-deck override returns 13 cards covering every
      glyph; bump `DECK_CONFIG.handSize` + `maxHandSize` to 13 to see them
      all in one hand
- [ ] Spot-check 3 flagged flavor lines (CLIFFSIDE / COLLAPSE /
      GRAVITY_WELL) for tone/clarity — revise if needed before merge
- [ ] Verify reduce-motion via OS toggle AND in-game settings — both
      paths now wired (S67-S70 fix)
- [ ] Eyeball decorative density on a Cartographer rare card with a
      keyword (worst case: CARTOGRAPHER_SEAL with all archetype layers
      stacked)

## Files changed

- 2 new services: `TowerThumbnailService` (root-scoped, ~230 lines, S79+),
  + `EffectIconPath` data file (S91)
- 1 new component: `DescriptionTextComponent` (standalone, parses {kw-*}
  tokens, renders inline icons inline with text)
- 1 new SCSS partial: `_card-tokens.scss` (~140 tokens across 14 groups)
- 14 + 11 SVG icons in IconRegistry (6 keyword + 4 archetype + refresh of
  4 type, then 11 new fx-* + 1 fx-link)
- 1 new integration spec: `card-branding.integration.spec.ts` (152 specs
  guarding cross-surface binding consistency)
- `CardDefinition` field additions: `archetype` (required, Phase A),
  `flavorText` (optional, Phase G), `effectGlyph` (optional, S91)
- 8 in-repo phase close docs + 1 branch close doc + 1 browser-smoke checklist

## Out of scope

- New cards (content)
- Balance changes
- New keywords / mechanics
- Audio
- Foil/holographic effects
- i18n / translation hooks
- Modifier chips on towers (deferred branch)

## Documentation

Full permanent record at `docs/cards/card-branding-close.md`. Per-phase
close docs at `docs/cards/phase-{a,b,c,d,e,f,g,h}-close.md`. Visual-rescue
+ glyph-system iteration history is in commit messages S73-S101 (no
separate close doc — the system was small enough to reason about from
git log + this PR body).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
