# Card Branding — Phase C Close

Branch: `feat/card-branding`. Phase C ran S19–S28 (10 sprints). Archetype
identity now reads on every card surface.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S19 | Archetype trim color tokens | bfa493d (bundled with S20) |
| S20 | ArchetypeDisplay metadata extension | bfa493d |
| S21 | Card-hand archetype trim (inset shadow) | 8ce0fab |
| S22-S25 | 4 archetype art-zone backdrops | 401d8cd (bundled) |
| S26 | Pile inspector archetype trim stripe | 612d41d (bundled with S27) |
| S27 | Library tile archetype trim + backdrop | 612d41d |
| S28 | Phase C close (this commit) | — |

5 commits this phase (sprints bundled where dependencies allowed).

## What ships visually

For the first time, Cartographer / Highground / Conduit / Neutral cards
read as visually distinct on every surface. Two reinforcing layers:

### Archetype trim — colored ring on polygon outline

Inset box-shadow that follows the clip-path silhouette. 2px at rest,
3px on hover. Hue-distance verified:

- **Cartographer** `#4a9a72` (155° green-teal)
- **Highground** `#b8724a` (22° terracotta)
- **Conduit** `#7a6ab8` (258° pure violet)
- **Neutral** `#7a7a88` (charcoal-silver)
- **Siegeworks** `#b86a6a` (deferred to Phase 5)

Color choices documented with rationale in S19+S20 commit body. Cartographer
pulled toward green from the starter teal to put it 103° from Conduit (vs.
60° in the starter). Highground pushed toward terracotta to put it 38° from
rare gold rather than a fight at 24°. Neutral brightened from #6a6a78 to
survive against the dark card background.

### Archetype backdrop — subtle SVG pattern in art zone

Layered beneath the per-type radial gradient. Visible at art-zone
periphery; gradient dominates the center.

- **Cartographer**: 3 Bézier survey lines (topographic contours)
- **Highground**: 3 concentric ellipses (terrain peak from above)
- **Conduit**: H+V crosshair + 5 nodes (circuit grid; most legible)
- **Neutral**: 45° cross-hatch (blueprint)

SVG sizes per pattern: 197–465 chars. All inline in `_card-tokens.scss`
as `data:image/svg+xml;utf8` URLs.

## Architecture decisions locked

1. **Trim is `box-shadow: inset`, NOT another drop-shadow filter.** Adding
   a third drop-shadow would push past the 4.4ms paint budget identified
   in S9. Inset shadow renders inside the box, naturally clipped by
   clip-path — exactly what trim should be. GPU-cheap.
2. **Trim color flows through CSS vars on the card element**:
   `[style.--archetype-trim-color]` and `[style.--archetype-trim-color-strong]`
   set the value; SCSS reads `var(--archetype-trim-color)`. Decouples color
   choices from component code.
3. **Backdrop layers in `background-image` stack** alongside the existing
   per-type radial gradient. Single `::before` element, two background
   layers. Existing `::after` scan-line texture untouched.
4. **Library tile framed glow corrected in passing.** S27 replaced
   `box-shadow: none !important` on framed tile variants with proper
   inset trim + `filter: drop-shadow` for rarity outer glow. Mirrors
   card-hand's pattern — was a Phase B oversight.
5. **Card-draft archetype trim deferred.** No existing archetype wiring
   in card-draft; adding it exceeded Phase C scope. Pattern is mature
   enough to bolt onto card-draft in a future sprint without redesign.

## Specs added

+27 net across the phase:
- archetype.constants.ts: +4 (trimVar contract for all 5 archetypes,
  helper coverage)
- card-hand.component: +12 (trim binding × 4 archetypes, backdrop binding
  × 4 archetypes, related composition)
- pile-inspector.component: +4 (trim binding per archetype)
- library-card-tile.component: +7 (trim + backdrop bindings, framed
  variant correction)

## Surfaces propagated

- card-hand: trim ring + backdrop pattern
- pile-inspector: 3px left-edge stripe (no backdrop — would be illegible
  at row scale)
- library-card-tile: trim ring + backdrop pattern (matches card-hand)
- card-draft: DEFERRED — no archetype wiring existed
- card-detail-modal: untouched, Phase F

## Browser-smoke items added to checklist

Karma cannot inspect rendered pixels. New items for the user to verify:

1. Cartographer / Highground / Conduit cards visibly distinct from Neutral
   in card-hand at a glance
2. Archetype trim color follows polygon outline (does NOT bleed to
   bounding rectangle) on every framed card
3. Highground rare card: does the terracotta trim coexist with rare gold
   glow without a fight? S20 verified at 38° hue separation but eyeball
   is the final test.
4. Pile inspector: archetype trim stripe coexists with upgrade gold tint
   on upgraded rows
5. Library tile: existing archetype badge chip not obscured by backdrop
6. Library tile rare shimmer pulse + inset trim composition — any
   compositor flattening artifacts?
7. Backdrop visibility: are the 4 patterns SUBTLE-but-present, or did
   any disappear? The S22-S25 close noted Conduit grid is most legible;
   Cartographer / Highground organic lines are softer (intentional). If
   any pattern is invisible in real card context, bump SVG stroke
   opacity from 0.35-0.55 → 0.75 in the corresponding token.

## Test posture

7451 → 7462 SUCCESS / 0 FAILED / 1 skipped throughout the phase. Build
clean. No spec regressions across S26+S27's library tile correction.

## Carry-forward into Phase D

Phase D adds keyword icons (terraform, link, exhaust, retain, innate,
ethereal). Inherits:

1. CSS-var indirection pattern. Icon glyphs likely flow through tokens
   too — `--keyword-icon-terraform` etc. for shared rendering.
2. Inset shadow vs filter chain decisions. Icons render via inline SVG
   or icon-font; no clip-path concerns expected.
3. The existing `IconRegistry` (`/Users/edconde/dev/Novarise/src/app/shared/components/icon/icon-registry.ts`).

## What this phase deliberately did NOT do

- Animate any backdrop pattern. Static only.
- Add full-card backdrops to pile inspector (illegible at row scale).
- Wire card-draft for archetype identity (no existing wiring; out of
  scope).
- Touch card-detail modal (Phase F).
- Add archetype-counter UI (the original plan deferred this to later).
- Add player-facing dominant-archetype indicator (deferred).

The card silhouette (Phase B) + archetype trim/backdrop (Phase C) form
the visual identity foundation. Phase D layers in keyword vocabulary on
top.
