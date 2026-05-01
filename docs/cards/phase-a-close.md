# Card Branding — Phase A Close

Branch: `feat/card-branding` (cut from `main` at 87b8a64).
Phase A scope: foundation only. No visual changes ship in Phase A; this
phase establishes the substrate that Phases B–H build on.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S1 | Dead-card audit | 1d0b94f |
| S2 | Stale-comment cleanup | 1d0b94f (bundled with S1) |
| S3 | `_card-tokens.scss` design-token catalog | 22fa6a9 |
| S4 | Rewire 7 card SCSS files to consume tokens | e3bd1de |
| S5 | Naming audit (47 neutral cards) | 22fa6a9 (bundled with S3) |
| S6 | Apply 11 card renames | e3bd1de (bundled with S4) |
| S7 | Promote `CardDefinition.archetype` to required | 4d4414d |

4 commits total.

## Foundation pieces in place

### Token catalog

- `src/styles/_card-tokens.scss` — 79 tokens across 12 groups: card sizing
  (3 breakpoints), background, type colors, art-zone opacity, scan-line
  texture, rarity treatment (common/uncommon/rare with separate inner/outer
  glow), state (hover/unplayable/pending), upgraded state, transitions,
  accent border widths, library tile sizing, modal sizing, archetype badges.
- Imported in `src/styles.scss` between `_variables` and `_base`.
- Reduce-motion companions defined for every animation duration token
  (`*-reduced` set to 0ms).
- 7 card surfaces consume the tokens (≈120 reference sites).

### Type contract

- `CardDefinition.archetype` is now required, not optional. Every card must
  declare its archetype at definition time.
- 50 neutral cards now carry explicit `archetype: 'neutral'` (was previously
  the implicit-undefined default).
- 24 archetype-aligned cards (8 cartographer + 8 highground + 8 conduit) are
  unchanged and verified.

### Naming consistency

- 11 cards renamed for legibility:
  - Tower variant order normalization: `Cluster Splash → Splash Cluster`,
    `Aura Slow → Slow Aura`, `Tesla Chain → Chain Tesla`,
    `Barrage Mortar → Mortar Barrage`.
  - Identity / signal fixes: `Enemy Slow → Heavy Fog`,
    `Gold Interest → Bounty Orders`, `Draw Two → Quick Draw`,
    `Battle Surge → Emergency Orders`, `Iron Will → Far Sight`,
    `Advance Guard → Forward Pay`, `Warp Strike → Phase Bolt`.
- CardId enum values are unchanged. SeenCardsService persistence keys on
  CardId, so save data is unaffected.

### Comment hygiene

- 10 stale sprint-ref comments removed across the SCSS rewire (per the
  evergreen-comments rule).
- One stale "All 25 cards defined" header comment in `card-definitions.ts`
  rewritten to drop the obsolete count.

## Test posture

7374 SUCCESS / 0 FAILED / 1 skipped throughout the phase. Inherited baseline
from PR #35 unchanged.

## Audit docs landed

- `docs/cards/dead-card-audit.md` — proves the 1-to-1 enum/definition
  correspondence is enforced at compile time. The earlier "135 vs 74" recon
  estimate was a Haiku miscount; reinforced the no-Haiku-agents rule for
  the rest of the branch.
- `docs/cards/naming-audit.md` — full per-card verdict table + H3 keyword
  quality matrix (7 STRONG / 5 WEAK / 3 BAD). The 3 BADs are now resolved
  via the S6 renames.

## Test-debt finding deferred

22 cards have no dedicated behavioral spec coverage (see `dead-card-audit.md`
table). These are NOT bugs — they are reachable via the reward pool and
type-checked at compile time. Adding behavioral specs is out of scope for a
UI/UX branding branch; deferred to a future spec-debt sprint.

## SCSS literals deferred

S4 left a small set of literal values in card SCSS that have no semantic
token equivalent yet:

- Shimmer-band opacities (animation-geometry specific, not a semantic value).
- `grayscale(40%)` filter (Sass intercepts the function; `var()` cannot be
  passed inside).
- Upgrade badge gradient colors (`#d9b3ff / #8e4de0 / #1a0822`) — design
  values without a planned token.
- `--spacing-xxs`, `--spacing-2xs`, `--radius-xs`, `--text-primary`,
  `--text-secondary`, `--glass-bg-strong` — referenced in card tooltip
  with inline fallbacks. These belong in `_variables.scss`, not
  `_card-tokens.scss`. Flagged for a future global-tokens sprint.

## Internal identifiers untouched

S6 deliberately did not rename internal identifiers tied to CardId
(`drawTwoCount`, `ironWillRangeBoost`, `advanceGuardGold`, etc.). These
track the enum, not the display name; renaming them is a separate concern
and would create a churn diff with no functional benefit.

## What Phase A did NOT do

- No visual changes the user can see in the browser.
- No frame-shape work (Phase B).
- No archetype trim (Phase C).
- No keyword icons (Phase D).
- No flavor text (Phase G).

The branch looks identical to the user at the end of Phase A. Foundation
work is invisible by design.

## What unblocks Phase B

- Token catalog ready to absorb new shape tokens.
- Archetype is a guaranteed first-class field — the CSS class generator can
  trust `card.archetype` is always set.
- Naming is consistent — the visual identity work won't surface a card
  named "Draw Two" looking like a placeholder.
- Reduce-motion hooks are in place — Phase B animation work plugs into the
  existing `*-reduced` token pattern.

## Predicted blow-ups for Phase B (carry-forward)

From the original plan doc, these still apply:

1. Frame-shape clip-path performance — clip-path on 8+ cards may cause
   repaints during fan-overlap hover. Layered pseudo-elements with
   overflow-clip is the fallback.
2. Tower footprint vertical space — limited card real estate. Reserve
   0.6rem bottom strip and verify mobile.

## Phase B kickoff

Next session opens `project_card_branding_phaseB_kickoff.md` (memory) for
sprint 9 onward. Phase A kickoff (`project_card_branding_phaseA_kickoff.md`)
can be retired.
