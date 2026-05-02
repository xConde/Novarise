# Card Branding — Phase G Close

Branch: `feat/card-branding`. Phase G ran sprints S59 + S60-S65 (bundled)
+ S66. Flavor text added to every card.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S59 | flavorText field + 3-surface display | dbc899a |
| S60-S65 | Mass write 74 flavor lines (bundled) | 56ea2cc |
| S66 | Phase G close (this commit) | — |

3 commits. 7718 → 7736 specs (+18 net).

## What ships

### Field

`CardDefinition.flavorText?: string` — optional, max 80 chars enforced
at spec level. Every card now carries it; presence + length specs
guard against regression.

### Display

Wired in 3 detail surfaces (NOT in-hand on the card face):
- card-hand tooltip (hover-only)
- card-detail modal (in-game right-click)
- library card-detail-modal (Codex deep-dive)

Style: italic, 0.7rem font, 50% opacity, straight-quote wrapping.
4 tokens in `_card-tokens.scss` `// === Card flavor ===`.
aria-label="Flavor: ..." prefix differentiates from mechanics text
for screen readers.

NOT wired in pile-inspector (text rows already cluttered) and NOT in
card-draft (reward decision context, not lore-reading context). NOT
on library tile (small surface; flavor lives in the deep-dive modal).

### Voice

Single creative pass, 74 lines, military-industrial register with
sci-fi accents per the Phase A naming audit's tonal finding.
Per-archetype voice:

- **Cartographer** — surveyor / cartographer / explorer
- **Highground** — climber / sentinel / mountain
- **Conduit** — engineer / network / circuit
- **Neutral** — tactical / artillery / standing-orders

Within neutral, sub-voices per type:
- Towers — artillery / fortification / weapon-system
- Spells — tactical orders / one-time interventions
- Modifiers — wave-long protocol / standing-procedure
- Utilities — efficiency / resource / pacing
- H3 keyword cards — keyword-as-metaphor

### Stats

- 74 lines written
- Average length: 46.8 chars (budget 80)
- Max: 60 chars (TOWER_SLOW_AURA)
- Min: 22 chars (DRAW_TWO / "Quick Draw")
- 80-char budget never felt tight

### Sample lines

- "Splash radius is doctrine." (TOWER_SPLASH)
- "Command selects the target. The sky obeys." (LIGHTNING_STRIKE)
- "Push the thermal limits. Count the kills. Justify it after." (OVERCLOCK)
- "Fire propagates. Fire does not ask permission." (INCINERATE)
- "Spend it before it forgets to exist." (PHANTOM_GOLD — exhaust keyword as metaphor)
- "From above, the battle is always smaller." (HIGH_PERCH)
- "The arc finds its own path through the crowd." (TOWER_CHAIN — describes mechanic without stating it)
- "Three days of survey for three turns of certainty." (SCOUT_AHEAD)

## Specs added

- 8 new specs in `card-definitions.spec.ts`:
  - flavorText present on every card (parameterized over all 74)
  - flavorText length ≤ 80 (parameterized)
  - flavorText not empty (parameterized)
  - 5 smoke assertions on specific flavor lines
- 3 specs each in card-hand / card-detail / card-detail-modal verifying
  the surface renders flavor when set, hides when undefined
- 2 pre-existing "undefined flavor" specs updated to reflect new
  display behavior

+18 net.

## Honest line revisions flagged

The agent surfaced 3 lines as candidates for revision in a follow-up
content pass:

1. **CLIFFSIDE** — "A horizontal ridge. The towers look down the barrel."
   The idiom "down the barrel" is ambiguous (could read as towers AT
   the wrong end of the gun rather than ABOVE the action).
2. **COLLAPSE** — "The ground does not care about their schedule."
   Functional but dry. A more cartographer-voiced revision would carry
   the path-destroy semantics better.
3. **GRAVITY_WELL** — "A trench is only a disadvantage if you dug it
   wrong."
   Borderline quippy for the grounded-military register. May not
   survive a stricter voice audit.

These are individual line revisions, not systemic issues. Phase H
polish or a future content pass can address. Acceptable to ship as-is.

## Browser-smoke items added

- All 3 detail surfaces show flavor below description, italic, muted
- 50% opacity is readable in modal contexts (S59 honest flag — bump
  to 60-65% if it disappears in any specific surface)
- aria-label "Flavor: ..." reaches screen readers correctly
- Cards with flavor render the line; cards with no flavor do NOT
  show empty whitespace

## Carry-forward into Phase H

Phase H is the final phase. Plan items:

- S67: Rarity animation budget — commons static, uncommons one ambient,
  rares pulse + glow. **Already largely in place** via existing
  rare-shimmer and pending-pulse animations. Phase H may just audit.
- S68: prefers-reduced-motion audit — verify all `*-reduced` token
  paths are wired and tested.
- S69: Performance audit — hand of 10 with all visual layers active.
- S70: Disposal audit — any new component-scoped pools (DescriptionTextComponent,
  card-detail integration spec).
- S71: Browser smoke checklist — final consolidation.
- S72: Close docs.

Phase H is shorter than Phase G; expect 3-5 commits.

## What this phase deliberately did NOT do

- No flavor on pile-inspector, card-draft, or library-tile.
- No mechanical change to any card.
- No name changes (S5+S6 already handled).
- No description changes.
- No translation/i18n hooks (would need a global pattern; not in scope).
