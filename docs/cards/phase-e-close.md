# Card Branding — Phase E Close (rescoped)

Branch: `feat/card-branding`. Phase E was originally planned as 8 sprints
(S41–S48): tower footprint preview + persistent-state board chips.
Mid-phase rescope shipped only the footprint work. The persistent-state
chip sprints (S44–S47) are deferred outside this branch.

## What shipped

| Sprint | Subject | Commit |
|---|---|---|
| S41+S42 | Tower footprint primitive + card-hand wiring | f36b0a0 |
| S43 | Footprint propagation to library tile + card-draft (pile-inspector skipped) | 9316a1c |
| S48 | Phase E close (this commit) | — |

3 commits this phase. 7534 → 7547 specs (+13 net).

## Footprint design

Small (1.2rem hand / 1.5rem tile) outlined square at bottom-center of
tower cards. Communicates "this card places a tower on a board tile"
at-a-glance. Color tinted via `var(--card-tower-accent)` so per-tower-type
accent flows (orange BASIC / purple SNIPER / lime SPLASH / blue SLOW /
yellow CHAIN / red-orange MORTAR).

Honest design choice (S41): rotated diamond rejected because at 1.2rem
on a 6.25rem card it collapsed into a lozenge that read as a warning
icon. Flat axis-aligned square reads unambiguously as "grid cell."

Surfaces: card-hand, library-tile, card-draft. Pile-inspector skipped
honestly — row already cluttered with shape badge / name / archetype
stripe; a fourth glyph adds cost without value.

## What was deferred and why

The original Phase E plan included 4 sprints (S44–S47) for
**modifier active-state chips on towers in the 3D game board**:

- S44 Modifier active-state chip primitive
- S45 Wire chip into game-board tile renderer
- S46 Modifier→tile lifecycle subscription
- S47 Reduce-motion compliance for chip pulse

Mid-phase, an honest scope reassessment determined this is **game-state
UX, not card branding**. The work crosses into Three.js territory
(towers are 3D meshes; chips would need CSS2DRenderer or sprite
positioning), requires lifecycle subscriptions to `CardEffectService`,
and adds disposal complexity matching the tower polish PR #35
discipline. None of that strengthens **card** identity — players don't
look at a card and learn from a chip on a tower; they look at a card.

The user's original ask was "stronger UI/UX card branding," which is
about cards, not board state indicators. Persistent-state chips on
towers are a worthy feature, but they belong in a separate game-UX
sprint outside this branch.

The deferral note will appear in `STRATEGIC_AUDIT.md` (or equivalent)
post-merge so the work isn't lost.

## What this rescope means

- Phase E is 3 sprints instead of 8.
- The remaining 5 sprints' worth of attention shifts to Phase F surface
  propagation, which actually completes the card branding arc
  (card-detail modal, library detail modal, mobile/tablet polish, etc.).
- Zero regressions — the rescope is forward-only.

## Specs added

+13 net specs:
- card-hand footprint binding (5)
- library-card-tile footprint binding (4)
- card-draft footprint binding (4)

## Browser-smoke items added

- Tower cards in card-hand show a small outlined square at bottom-center
- Footprint color matches tower type accent (orange BASIC / purple
  SNIPER / lime SPLASH / blue SLOW / yellow CHAIN / red-orange MORTAR)
- Footprint suppressed at mobile (≤480px) — verify cards don't show a
  squashed shape
- Library tile tower cards show 1.5rem footprint
- Card-draft tower cards show 1.5rem footprint (generic orange — no
  per-subtype variation; intentional, see S43 close)
- Pile inspector tower rows do NOT show a footprint (intentional skip)

## Carry-forward into Phase F

Phase F adds card-detail modal upgrade + library detail modal upgrade +
mobile/tablet pass + cross-component visual regression check.

The footprint glyph already lives in card-hand / library-tile /
card-draft. Phase F adds it to card-detail and library card-detail
modals.

## What this phase did NOT do (per the rescope)

- No modifier active-state chips on towers in game board.
- No CardEffectService lifecycle subscription work for chip primitives.
- No new Three.js / CSS2DRenderer work.

These are valid future sprints in a `feat/board-status-chips` branch.
