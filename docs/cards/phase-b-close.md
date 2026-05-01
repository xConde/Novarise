# Card Branding — Phase B Close

Branch: `feat/card-branding`. Phase B ran S9–S18 (10 sprints). First phase
with user-visible changes — cards now carry distinct silhouettes per type.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S9 | Frame primitive — clip-path + drop-shadow decision | 96f73a4 |
| S10 | Tower frame + framed-card glow system | 9de60fc |
| S11 | Spell frame — obelisk-peak silhouette | d218179 |
| S12 | Modifier frame — octagonal medallion | df04185 |
| S13 | Utility frame — bilateral chevron | d544c73 |
| S14 | Cross-type frame integration tests | 24ed2b9 |
| S15 | Pile inspector shape badges | f593031 |
| S16 | Card-draft per-type frames | 4e5307b |
| S17 | Framed-card cleanup pass | d1c5fb8 |
| S18 | Phase B close (this commit) | — |

10 commits. 7398 → 7435 specs (+37 net). Build clean.

## What ships visually

The four card types now read as distinct silhouettes at a glance:

- **Tower** — stepped battlements at top corners (8%/13% horizontal teeth,
  8% deep on hand, 5% on tile). Reads as fortification / parapet / building
  footprint. Bottom corners share a gentle chamfer.
- **Spell** — central peak at 50% top, shoulders descending through 25%/75%
  to 12% corners (hand) or 8% (tile). Reads as pointed / instant / arrow.
  Bottom matches Tower's chamfer for visual continuity.
- **Modifier** — 8-vertex chamfered octagon (12% corners on hand, 9% on
  tile). Reads as coin / seal / persistent token. Honest design choice:
  16-vertex faux-curve was rejected because at hand-card size facets were
  visible at rasterization.
- **Utility** — bilateral chevron cut on left/right edges at 50%–70%
  vertical band (hand) or 55%–75% (tile). Top zone uncut full-width so
  cost / icon / upgrade chrome have safe space. Reads as tag / label;
  honestly does not strongly telegraph "utility" to a new player without
  a legend.

## Architecture established

The framed-card system is now load-bearing. Future phases (C through H)
extend it without re-deriving:

1. **Rarity glow flows through CSS vars** (`--card-glow-color`,
   `--card-glow-blur`). Rarity selectors set the vars; the rendering
   primitive is chosen at the type-frame level (box-shadow for unframed,
   filter:drop-shadow for framed).
2. **Drop-shadow blur clamps via `min(var, --card-frame-drop-shadow-blur-max)`** —
   8px max. Prevents runaway blur from a future "rare upgraded pending"
   state stack.
3. **Hover brightness composes on a single `filter:` line** with
   drop-shadow (last-wins rule).
4. **Per-type pending keyframes** (`card-frame-{type}-pending-pulse`)
   animate the composed filter — the shared box-shadow pending pulse is
   invisible under clip-path.
5. **Clip-paths are token-based** — 4 polygons + 4 tile variants. Library
   tile and card-draft both pull from the tile variants (close aspect
   match at ~1:1.45).

## Surfaces propagated

- `card-hand` — full per-type frames + drop-shadow rarity glow
- `library-card-tile` — full per-type frames at tile aspect
- `pile-inspector` — 20px shape badges (per-type silhouettes, not full
  frames; Phase F may upgrade to full)
- `card-draft` — full per-type frames at tile aspect

NOT propagated (deferred):
- `card-detail` modal — reads card from any source; full-frame in modal
  is Phase F (S53).

## Accessibility

- Frame classes are visual-only — no a11y semantics depend on them.
- Pile inspector badges have `aria-hidden="true"`; card name remains the
  primary accessible label.
- Reduce-motion: each per-type pending keyframe has a `*-reduced`
  companion path mirroring S10's pattern.

## Browser-smoke items (S18)

The following CANNOT be verified in Karma; they require real-browser
inspection. Captured in `docs/cards/browser-smoke-checklist.md`:

1. **Rare-shimmer `::after` band under polygon** — clip-path on a stacking
   context should clip `::after` in Blink, but the visual result (whether
   the shimmer band reads correctly or gets awkwardly sliced by the
   battlement edge) needs human confirmation.
2. **Modifier-Utility fan seam at 10-card density** — Modifier's 12%
   lateral chamfer adjacent to Utility's 8% chevron inset may render as
   a visible gap at the overlap boundary.
3. **Filter composition on hover** — Karma does not expose computed
   filter values in ChromeHeadless. SCSS is correct by inspection.
4. **Clip-path visual quality at 3.75rem mobile width** — silhouettes are
   percent-based so they should scale, but rendering quality at small
   pixel sizes needs verification.
5. **60fps sustained during hover-fan** with all 4 frame types in a hand
   of 10. POC measurement was style-only; real GPU rasterization on
   integrated GPU could surface issues.

## Test posture

- 7398 → 7435 SUCCESS / 0 FAILED / 1 skipped throughout the phase.
- +37 specs added across the phase: per-type frame bindings, cross-type
  integration, fan-overlap mixed-type, mobile/tablet breakpoints, perf
  probe, pile inspector badges, card-draft frame bindings.
- Production build clean throughout.

## Deferred to later phases

- **Archetype trim color** — Phase C. Cartographer / Highground / Conduit
  cards have no visual identity yet; they all show as Neutral-equivalent.
- **Keyword icons** — Phase D. Letter badges (I/R/Et/Ex) still in use.
- **Tower footprint preview** — Phase E. Tower cards show the silhouette
  but not the placement footprint.
- **Per-archetype art-zone backdrops** — Phase C.
- **Flavor text** — Phase G.
- **Rarity animation budget** — Phase H.

## Carry-forward into Phase C

The next phase (archetype trim) inherits these patterns:
1. CSS-var indirection for visual properties — extend with
   `--card-archetype-color` and `--card-archetype-pattern`.
2. Tile-aspect variant pattern — Phase C tokens may need `*--tile`
   companions if the trim looks different on tiles vs hand.
3. Reduce-motion `*-reduced` companion tokens for any animated archetype
   element.
4. Two-class specificity beats !important — apply this lesson when
   composing archetype trim with rarity glow.

## What this phase deliberately did NOT do

- No keyword icons. Letter badges (I/R/Et/Ex) remain.
- No archetype identity on the card face. Cartographer cards still look
  like Neutral cards.
- No flavor text.
- No card art / illustration.
- No animation polish per rarity (commons / uncommons / rares all share
  the same animation budget for now).

The card silhouette is the FIRST identity layer. Phase C through G build
on top of it.
