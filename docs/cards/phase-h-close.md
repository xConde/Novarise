# Card Branding — Phase H Close (final phase)

Branch: `feat/card-branding`. Phase H ran sprints S67-S72 — final audits +
close. Mostly verification work; implementation was done across earlier
phases.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S67-S70 | Motion budget + reduce-motion + perf + disposal audit | d2bdb2d |
| S71+S72 | Phase H close + branch close + PR draft | (this commit) |

2 commits. 7736 specs unchanged (audit found CSS-only fixes).

## What this phase verified / fixed

### S67 — rarity animation budget: clean

The plan budget held across all 6 surfaces:
- Common / Starter: no animations beyond hover/play/pending
- Uncommon: zero ambient animations (color treatment only)
- Rare: exactly one ambient (the diagonal shimmer band)

### S68 — reduce-motion audit: 3 real bugs found and fixed

The audit found that 3 surfaces had `@media (prefers-reduced-motion)`
gates but were missing the in-game `body.reduce-motion` class fallback.
Both must be wired — `@media` catches the OS preference, the class
catches the in-game Settings toggle.

Fixed:
- pile-inspector backdrop fade-in
- card-detail-modal: modal-fade-in + modal-slide-in
- card-draft entry animation (card-draft-in)

**Pattern lesson:** Every new surface with a `@keyframes` must apply
BOTH the `@media (prefers-reduced-motion)` gate AND the
`body.reduce-motion` class fallback. One without the other is a
half-fix because users toggle motion via either path.

### S69 — performance: covered by existing probes

The S14 hand-of-10 perf probe asserts < 50ms layout cost on a mixed-type
hand with all visual layers active. No new probes added. Frame-rate
measurement during animation deferred to browser smoke (Karma cannot
measure 60fps).

### S70 — disposal: clean

DescriptionTextComponent (the only new component this branch) is a pure
`@Input → ngOnChanges → parser` pipeline. No subscriptions, listeners,
timers, or pools. Angular handles teardown fully. No disposal work
required.

## Branch summary

The card branding 70-sprint plan delivered across 8 phases:

| Phase | Sprints | Commits | Specs added |
|---|---|---|---|
| A — Foundation | S1-S8 | 5 | 0 (foundation only) |
| B — Frame silhouettes | S9-S18 | 9 | +37 |
| C — Archetype identity | S19-S28 | 5 | +27 |
| D — Keyword vocabulary | S29-S40 | 7 | +37 |
| E — Tower footprint (rescoped) | S41-S48 | 3 | +13 |
| F — Surface propagation | S49-S58 | 3 | +171 |
| G — Flavor text | S59-S66 | 3 | +18 |
| H — Audits + close | S67-S72 | 2 | 0 (audit only) |
| **Total** | **70** | **37** | **+303** |

The branch is **40 commits ahead** of `main`. **7736 specs / 0 failed /
1 skipped** (+362 over the inherited PR #35 baseline of 7374).

## What ships

The card branding system is structurally complete across 6 surfaces:

| Layer | card-hand | pile-inspector | card-draft | library-tile | card-detail (in-game) | library card-detail-modal |
|---|---|---|---|---|---|---|
| Frame silhouette (clip-path) | ✓ | shape badge only | ✓ | ✓ | (info panel) | (info panel) |
| Archetype trim ring | ✓ | left stripe | (deferred) | ✓ | ✓ | ✓ |
| Archetype backdrop pattern | ✓ | (illegible at row scale) | (deferred) | ✓ | ✓ | ✓ |
| Archetype sub-icon glyph | ✓ | — | — | — | ✓ | ✓ |
| Keyword icon badges | ✓ | — | — | — | ✓ | ✓ |
| Inline {kw-*} icons | tooltip | — | — | — | ✓ | ✓ |
| Tower footprint glyph | ✓ | (skipped) | ✓ | ✓ | ✓ | ✓ |
| Flavor text | tooltip | — | — | — | ✓ | ✓ |

## Honest carry-forward (not in this branch)

Items deferred outside this branch by deliberate scope discipline:

1. **Modifier active-state chips on towers** — game-state UX, not card
   branding. Belongs in a separate `feat/board-status-chips` branch
   (Phase E rescope).
2. **Card-draft archetype trim/backdrop** — no existing archetype
   wiring; refactor exceeds scope.
3. **Pile-inspector backdrop pattern** — illegible at row scale by
   design.
4. **3 flavor lines** flagged for revision (CLIFFSIDE / COLLAPSE /
   GRAVITY_WELL) — individual lines, not systemic.
5. **Tower clip-path battlements at 3.75rem mobile** — function
   correctly but readability is a design call (browser smoke).

## What this phase did NOT do

- No new content. No new mechanics. No new keywords.
- No new visual layers beyond what shipped through G.
- No translation/i18n hooks.
- No backwards-compatibility shims.

The branch is ready for browser smoke + merge.
