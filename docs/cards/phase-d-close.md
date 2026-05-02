# Card Branding — Phase D Close

Branch: `feat/card-branding`. Phase D ran S29-S40 plus an unplanned S37b
mass-edit. Keyword vocabulary, icon system, inline-text rendering, and
archetype glyph layer all shipped.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S29-S34 | 6 keyword icon designs (bundled) | a293296 |
| S35 | Icon registry update | a381214 |
| S36 | Letter badges → icons in card-hand | f221c5e |
| S37 | Description text parser + 3-surface wiring | 6bee7c2 |
| S37b | Mass-edit 30 descriptions to use {kw-*} tokens (bundled with S38) | b81e552 |
| S38 | Type icon refresh (4 icons normalized) | b81e552 |
| S39 | Archetype sub-icons in art zone | 3fcfac4 |
| S40 | Phase D close (this commit) | — |

7 commits. 7497 → 7534 specs (+37 net over phase).

## What ships

### Visual vocabulary
14 SVG icons all sharing identical geometric language:
- **6 keyword icons** (`kw-terraform`, `kw-link`, `kw-exhaust`,
  `kw-retain`, `kw-innate`, `kw-ethereal`)
- **4 type icons** (`crosshair`, `bolt`, `shield`, `gear`) — refreshed
  to match keyword vocabulary
- **4 archetype sub-icons** (`arch-cartographer`, `arch-highground`,
  `arch-conduit`, `arch-neutral`)

Shared spec: 24×24 viewBox, strokeWidth 1.5, `currentColor`, round line
caps, `fill="none"` on stroked elements (link/conduit nodes use stroked
circles, not filled, to maintain consistency).

### Icon usage
- **Keyword badges in card-hand**: replace I/R/Et/Ex letter glyphs.
  Plus 2 NEW badges that were previously invisible: terraform (Cartographer
  + Highground) and link (Conduit). 6 per-keyword tint colors documented
  in `_card-tokens.scss` `// === Keyword icon tints ===`.
- **Inline icons in description text**: parser + renderer in new
  `DescriptionTextComponent`. Token syntax `{kw-name}`. 30 descriptions
  across 15 cards now use the syntax (terraform / link tokens land at
  zero — those keywords are integrated in effect text rather than
  trailing keyword sentences). Wired into card-hand tooltip,
  card-detail modal in-game, library card-detail-modal.
- **Archetype sub-icon glyph**: 24px corner accent in card art zone,
  tinted via `var(--archetype-trim-color)` at 50% opacity.

### Architecture established

1. **`{kw-name}` token syntax** for inline icons. Linear regex parser.
2. **`DescriptionTextComponent`** as standalone Angular component;
   parser produces typed segments (text vs icon), template iterates and
   renders each.
3. **Icon naming convention**: `kw-*` for keyword icons, `arch-*` for
   archetype glyphs, plain names (`crosshair` / `bolt` / etc.) for type
   icons. Avoids collision with the existing `exhaust` flame icon used
   for the exhaust pile counter.
4. **Per-keyword color tokens** flow through CSS vars. Each keyword
   badge in card-hand uses `color: var(--keyword-color-name)`; icons
   inherit via `currentColor`.

## Specs added

+37 net specs across the phase:
- keyword-icon-paths.spec.ts (3 design specs)
- icon.component.spec.ts (29 — keyword + archetype icons + stroke-consistency
  parameterized over all icons)
- description-text.component.spec.ts (parser cases — token / no-token /
  unknown / empty / position)
- card-hand.component.spec.ts (badge bindings, tint, archetype glyph)

## Surfaces propagated

- **card-hand**: keyword badges, archetype sub-icon, tooltip description
  with inline icons
- **card-detail modal (in-game)**: description with inline icons
- **library card-detail-modal**: description with inline icons (both
  base and upgraded panels)

## Surfaces NOT propagated

- **pile-inspector**: text-only rows, no description rendering. No icon
  changes (existing 20px shape badges from Phase B remain).
- **card-draft**: no archetype identity wiring (deferred from Phase C
  for the same reason). Type icons in draft are unaffected by S38
  refresh because the same names resolve to the new SVG paths.
- **library tile**: existing archetype badge chip carries the labeled
  "CARTOGRAPHER" / etc. tag; no inline-icon descriptions on tiles.

## Honest legibility flags carried forward

These items need browser smoke (S40 / Phase H polish):

1. **Retain padlock arch + ethereal vapor wisps**: still close visually
   at 14px badge size — both read as "soft/airy" silhouettes. Fallback
   path documented in S29-S34: dashed card-rect for ethereal, solid
   card-rect for retain.
2. **Bolt icon at 12px**: stroked polyline thinner-feeling than the old
   filled silhouette. Tooltip-size legibility test required.
3. **Cartographer compass rose at 50% opacity**: 8 ticks may compress
   to visual noise. Fallback: drop the 4 diagonal ticks, keep only
   N/E/S/W.
4. **Long card names**: 6.25rem card with a name like
   "CARTOGRAPHER'S SEAL" may have leftmost characters visually overlap
   the sub-icon at 0.4rem left. Tolerable as art-zone decoration but
   verify.
5. **3 archetype signals + keyword badges + chrome**: card face now
   carries trim ring + backdrop pattern + sub-icon for archetype
   identity, plus type icon + cost pill + upgrade badge + keyword
   badges + name + description (truncated). Net opacity is low
   (backdrop 4-7%, sub-icon 50%) but the count matters. Browser smoke
   is the only honest test.

## Browser-smoke items added

To be added to `docs/cards/browser-smoke-checklist.md`:

1. All 6 keyword badges visible on cards with the corresponding flag
2. terraform + link badges (NEW since pre-D) appear correctly
3. Inline icons in tooltip / detail modal align to text baseline cleanly
4. Inline icons render in `{kw-exhaust}.` patterns without doubled
   periods or weird spacing
5. Type icon refresh (S38) — bolt at 12px in tooltip readable as
   lightning, not just a thin diagonal
6. Archetype sub-icon visible on each archetype's cards
7. Cartographer compass at 50% opacity readable, not noise
8. Long-card-name + sub-icon overlap acceptable
9. Mobile cards (≤480px) hide sub-icon cleanly (don't crowd)
10. Reduce-motion: no animations were added in Phase D, so this is
    just a "did anything regress" check

## Test posture

7497 → 7534 SUCCESS / 0 FAILED / 1 skipped throughout the phase. Build
clean. Inherited PR #35 baseline preserved across +160 specs total
(Phase A 0, Phase B +37, Phase C +27, Phase D +37, plus indirect
parameter additions).

## Carry-forward into Phase E

Phase E adds tower placement footprint preview + persistent-state chips
on the board. Inherits:

1. The icon registry has room for a tower-footprint glyph if needed.
2. CSS-var indirection for visual properties — extend with footprint
   color and chip color tokens.
3. Component-scoped pattern for new visual primitives (footprint mini-viz
   probably fits as a Phase E new component).

## Predicted Phase E blow-ups

1. Tower footprint placement on tower cards: bottom 0.6rem strip
   reserved in plan, but mobile cards (3.75rem wide) compress this. May
   need to suppress footprint on mobile.
2. Modifier active-state chip on the game board itself (NOT on cards):
   crosses into game-board territory. New service or component-scoped
   logic needed in `GameBoardComponent`.
3. Lifecycle: chips need to appear when modifier becomes active,
   disappear when expired. Subscription discipline + disposal.

## What this phase did NOT do

- No flavor text. Phase G.
- No tower footprint preview. Phase E.
- No on-board persistent-state chips. Phase E.
- No animation polish per rarity. Phase H.
- No motion budget changes. Phase H.
- No card-detail or card-draft archetype propagation. Phase F or
  follow-up.
