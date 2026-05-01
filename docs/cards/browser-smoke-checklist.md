# Card Branding — Browser Smoke Checklist (Phase B)

This list covers the items Karma cannot inspect. Run `npm run dev`
(port 3999) and walk through each item. Mark ✅ / ⚠️ / ❌ inline.

## Setup

- [ ] `git checkout feat/card-branding`
- [ ] `npm test` passes (7435 SUCCESS / 0 FAILED / 1 skipped)
- [ ] `npm run dev` running on port 3999
- [ ] Open `/run` and start an encounter so you have a hand of cards
- [ ] Open Chrome DevTools, Performance tab ready

## Frame silhouettes (in card-hand)

- [ ] Tower cards visibly show stepped battlements at the top corners
- [ ] Spell cards visibly show a center peak at the top
- [ ] Modifier cards visibly show octagonal corners (chamfered, not curved)
- [ ] Utility cards visibly show V-cuts on left and right edges
- [ ] At hand of 5 mixed types, each card is clearly distinguishable from
      its neighbors at a glance — type identity reads in <1 second

## Frame quality at viewport sizes

- [ ] Desktop (default): all 4 silhouettes render cleanly
- [ ] Tablet (resize browser to ~768px wide): silhouettes still legible at
      5.25rem card width
- [ ] Mobile (resize to ~375px): silhouettes still legible at 3.75rem;
      no broken-looking polygons or jagged edges

## Glow + clip-path interaction

- [ ] Hover any framed card — gold/blue glow follows the polygon silhouette,
      NOT the bounding rectangle
- [ ] Uncommon (blue) framed cards: blue glow contained within polygon
- [ ] Rare (gold) framed cards: gold glow contained within polygon
- [ ] Upgraded framed cards: gold glow contained within polygon
- [ ] Pending cards (the one you're about to play): pulse animation runs
      smoothly — same per-type silhouette, brightness varies

## Rare shimmer (the deferred S10 flag)

- [ ] Find or force a rare card into your hand (e.g., FORTIFY, OVERCLOCK,
      LAST_STAND, ENERGY_SURGE — none are starters; reach via combat
      reward or shop)
- [ ] Confirm: rare gold shimmer band still sweeps across the card
- [ ] Confirm: shimmer band stays inside the polygon (does NOT extend to
      the bounding rectangle)
- [ ] If the shimmer looks awkwardly cropped on a Tower or Utility card,
      flag it — may need a Phase H polish sprint

## Fan overlap (the deferred S14 flag)

- [ ] Force a hand of 10 cards (combine multiple rewards or use dev tools)
- [ ] Verify cards stack with negative left margins (fan mode)
- [ ] Hover through every card in the fan one at a time. Smooth?
- [ ] Specifically check: a Modifier card adjacent to a Utility card. Is
      there a visible gap or seam at the overlap boundary?
- [ ] If yes, capture the viewport in screenshot and flag for tightening
      Utility's 8% chevron inset OR pulling Modifier's 12% chamfer.

## Pile inspector

- [ ] Click any pile counter (Draw / Discard / Exhaust) at the bottom-right
- [ ] Modal opens with grouped card list
- [ ] Each row carries a 20px silhouette badge before the name
- [ ] At 20px, can you distinguish Tower vs Spell vs Modifier vs Utility?
      (Tower battlements may be marginal — flag if unreadable)
- [ ] Upgraded cards still gold-tinted; badge is NOT gold-tinted (sibling
      span, no inheritance)

## Card draft (combat reward)

- [ ] Win a wave to trigger a reward draft
- [ ] Three card-shaped reward buttons appear in a 3-up grid
- [ ] Each draft card shows its per-type silhouette
- [ ] Hover a draft card: the slight scale + glow follows the polygon
- [ ] Click to "select" a draft card — selected gold glow follows the
      polygon, NOT the bounding rectangle (this is the S17 fix)
- [ ] Skip-for-gold button still works (it's a different visual; should
      be unaffected)

## Library

- [ ] Open `/library`
- [ ] Each tile shows its per-type silhouette
- [ ] Filter to towers only — all tiles show battlement silhouette
- [ ] Filter to spells only — all tiles show peak silhouette
- [ ] Repeat for modifier and utility
- [ ] Click a tile, modal opens, dismisses cleanly

## Performance

- [ ] DevTools → Performance tab → record 5 seconds
- [ ] During recording: hover through every card in a hand of 10 mixed types
- [ ] Stop recording
- [ ] Look for frame drops below 60fps (red bars on the FPS lane)
- [ ] If any frame drops: capture and flag for Phase H optimization

## Reduce motion

- [ ] System prefs → enable "Reduce motion" (Mac: Settings > Accessibility
      > Display > Reduce motion)
- [ ] Refresh the game tab
- [ ] Pending pulse on a card: should not animate (`-reduced` token = 0ms)
- [ ] Card-play lift on a played card: should not animate
- [ ] Tooltip enter: should not animate
- [ ] Modal enter (pile inspector): should not animate
- [ ] Tile rare-shimmer: should not animate (in library)

## Final sign-off

- [ ] All four card types are visually distinct at a glance — Phase B's
      core promise.
- [ ] No regressions to existing card behavior (clicks, drag, hotkeys).
- [ ] No console errors.
- [ ] Mobile layout doesn't squeeze or break.

If everything is green, Phase B is closed and ready for Phase C
(archetype trim color system).

If anything is yellow / red, file follow-up issues with screenshots and
either:
- Address in Phase C if it's archetype-related
- Address in Phase H polish if it's animation/perf related
- Address in a quick-fix S18.x sprint if it's a regression

---

# Phase C additions (after Phase B items)

## Archetype trim — card-hand

- [ ] Force a Cartographer card into hand (e.g., LAY_TILE, SCOUT_AHEAD,
      DETOUR). The card has a green-teal ring along its polygon outline,
      visibly different from Neutral.
- [ ] Force a Highground card into hand (e.g., RAISE_PLATFORM, HIGH_PERCH).
      Terracotta ring.
- [ ] Force a Conduit card into hand (e.g., HANDSHAKE, FORMATION).
      Violet ring.
- [ ] Neutral cards: charcoal-silver ring, "quiet but present"
- [ ] Hover any framed card — trim widens (2px → 3px) and brightens (uses
      the strong variant of the archetype color)
- [ ] Trim follows the polygon outline (battlements / peak / octagon /
      chevron), NOT the bounding rectangle

## Archetype trim — composition with rarity

- [ ] Highground rare card (e.g., KING_OF_THE_HILL, GRAVITY_WELL): does
      the terracotta trim fight with the gold rare glow? Should be 38° hue
      separation — flag if it looks like "off-gold" rather than two
      distinct colors.
- [ ] Cartographer rare card (CARTOGRAPHER_SEAL, LABYRINTH_MIND): green-teal
      trim + gold rare glow.
- [ ] Conduit rare card (ARCHITECT, HIVE_MIND): violet trim + gold rare glow.

## Archetype backdrop — card-hand

- [ ] Cartographer cards: 3 curved survey lines visible in art zone
- [ ] Highground cards: concentric elevation rings centered below middle
- [ ] Conduit cards: H+V crosshair grid with corner + center circle nodes
- [ ] Neutral cards: 45° cross-hatch (subtle / quiet)
- [ ] Patterns are SUBTLE — visible but not competing with the type
      gradient. If any pattern is invisible in real card context, the
      design knob is in `_card-tokens.scss` `--card-backdrop-*` SVG
      stroke opacity (0.35-0.55 currently; bump to 0.75 if needed).

## Pile inspector — archetype trim

- [ ] Each row carries a 3px colored left-edge stripe in the archetype
      color
- [ ] On upgraded rows: the gold border + the archetype stripe coexist
      (gold = 4-side border, archetype = left-edge inset shadow). Both
      visible.
- [ ] No backdrop pattern in pile inspector (intentional — illegible at
      row scale)

## Library tile — archetype trim + backdrop

- [ ] Each tile carries archetype trim ring (matches card-hand)
- [ ] Each tile carries archetype backdrop pattern (matches card-hand)
- [ ] Existing archetype badge chip (the labeled chip showing
      "CARTOGRAPHER" etc.) is NOT obscured by the backdrop
- [ ] Framed rare tile: rarity glow follows polygon outline via
      filter:drop-shadow (NOT box-shadow rectangle leak)
- [ ] Rare shimmer keyframe + inset trim composition: shimmer pulses
      cleanly, trim color persists through the pulse

## Card-draft

- [ ] Card-draft cards do NOT yet show archetype trim or backdrop
      (deferred from Phase C; planned for a future sprint). Type frame
      silhouette is correct (Phase B work). No regression here.

---

# Phase D additions (after Phase C items)

## Keyword icon badges (card-hand)

- [ ] Cards with `terraform` flag (Cartographer + Highground): cyan
      terraform mountain+arrow icon visible on card face
- [ ] Cards with `link` flag (Conduit): violet link node-line icon
      visible on card face
- [ ] Cards with `innate` flag: lime green star icon
- [ ] Cards with `retain` flag: amber padlock-on-card icon
- [ ] Cards with `ethereal` flag: pale violet vapor wisps icon
- [ ] Cards with `exhaust` flag: orange-red card-with-X icon
- [ ] Multiple-keyword cards (e.g., a Conduit card with link + exhaust):
      both badges visible side-by-side, no crowding
- [ ] Keyword badges at ~14px size are recognizable, NOT just colored
      blobs

## Inline keyword icons in description text

- [ ] Open card-hand tooltip on a card with a `{kw-*}` token in
      description (e.g., LAST_STAND with "Restore 5 lives. {kw-exhaust}.")
- [ ] Inline icon renders inline with text, baseline aligned
- [ ] No doubled periods, no weird spacing, no missing letters
- [ ] Same check in card-detail modal (right-click a card)
- [ ] Same check in library card-detail modal

## Type icon refresh

- [ ] Tower card type-icon (crosshair) at 20px in card-hand: readable
      as a target reticle
- [ ] Spell card type-icon (bolt) at 20px: readable as lightning
- [ ] Spell type-icon at 12px in tooltip: still readable as lightning
      (this is the S38 honest-flag — bolt was the hardest refresh)
- [ ] Modifier card type-icon (shield) at 20px: clear shield
- [ ] Utility card type-icon (gear) at 20px: gear teeth visible
- [ ] All 4 type icons share visual vocabulary with keyword icons

## Archetype sub-icons

- [ ] Cartographer cards: compass rose visible at top-left of art zone
      (50% opacity, green-teal). Compass tick marks readable, NOT a smear
- [ ] Highground cards: mountain ridge silhouette visible (terracotta)
- [ ] Conduit cards: 3-node link triangle visible (violet)
- [ ] Neutral cards: crosshatch X mark visible (charcoal-silver, very
      subtle)
- [ ] Sub-icon does NOT visually conflict with the leftmost character
      of long card names (e.g., CARTOGRAPHER_SEAL)
- [ ] Mobile (≤480px): sub-icon hidden cleanly, no broken layout

## Decorative density check (the big one)

- [ ] Examine a Cartographer rare card with a keyword: does the layered
      identity (frame silhouette + trim ring + backdrop pattern + sub-icon
      + keyword badge + cost + type icon + upgrade badge + name +
      description) feel cohesive or busy?
- [ ] If "busy": which signal feels redundant? Trim + backdrop + sub-icon
      is a triple archetype signal. Sub-icon at 50% opacity is the most
      removable layer if needed.


---

# Phase E additions (after Phase D items)

## Tower footprint preview

- [ ] Tower cards in card-hand: small outlined square at bottom-center
- [ ] Color matches tower type (BASIC orange / SNIPER purple /
      SPLASH lime / SLOW blue / CHAIN yellow / MORTAR red-orange)
- [ ] Spell / Modifier / Utility cards do NOT show a footprint
- [ ] Mobile (≤480px): footprint hidden cleanly
- [ ] Library tile tower cards: 1.5rem footprint at bottom
- [ ] Library tile color: per-tower-type via --tile-tower-accent
- [ ] Card-draft tower cards: 1.5rem footprint (generic orange —
      card-draft has no per-subtype binding; this is intentional)
- [ ] Pile-inspector: NO footprint glyph (intentional skip per S43)
- [ ] Footprint feels like decoration, not chrome — should NOT
      attract attention away from name / cost / type icon


---

# Phase F additions (after Phase E items)

## Card-detail modal (in-game, right-click on a card)

- [ ] Modal opens when right-clicking a card in card-hand
- [ ] Modal shows archetype trim ring around the panel
- [ ] Modal shows archetype backdrop pattern in the top art-zone strip
- [ ] Cartographer / Highground / Conduit cards: their archetype color
      / pattern visible
- [ ] Neutral cards: charcoal trim, blueprint cross-hatch backdrop
- [ ] Archetype sub-icon glyph visible in art zone (compass / peaks /
      3-node / X mark)
- [ ] Tower cards show footprint glyph
- [ ] Keyword icons (NOT text labels) appear for cards with keywords
- [ ] Inline {kw-*} icons in description text render correctly
      (e.g., LAST_STAND shows the exhaust card-with-X icon inline)
- [ ] Modal is NOT a polygon clip-path silhouette — it's a wide info
      panel with rounded corners. Confirmed honest design choice.

## Library card-detail-modal

- [ ] Same checks as in-game modal
- [ ] Both base and upgraded panels carry trim + backdrop
- [ ] Existing archetype text chip in meta row coexists with new
      archetype sub-icon (different elements, both visible)

## Cross-surface consistency

- [ ] Same card viewed in card-hand, library tile, and card-detail
      modal: identity reads consistently (same archetype color, same
      backdrop pattern, same keywords)
- [ ] Tower cards show the footprint glyph in all 4 surfaces
      (card-hand, library tile, card-draft, both modals) — NOT in
      pile-inspector
- [ ] Archetype trim color matches across surfaces (pull a Cartographer
      card and check teal in all surfaces)

## Mobile (≤480px) responsive

- [ ] Card-hand cards: 3.75rem width, sub-icon hidden, footprint
      hidden, keyword badges hidden
- [ ] Tower clip-path battlements at 3.75rem: are the ~5px notches
      readable as battlements, or do they look like visual noise?
      (HONEST FLAG — if the latter, Phase H polish suppresses the
      polygon at mobile and falls back to flat rectangle on tower
      mobile cards)
- [ ] Modal at mobile width: layout intact, no horizontal scroll
- [ ] Pile inspector: rows still readable


---

# Phase G additions (after Phase F items)

## Flavor text rendering

- [ ] Open card-hand tooltip on any card — flavor line appears
      below description, italic, muted, in straight quotes
- [ ] Same in card-detail modal (right-click on card)
- [ ] Same in library card-detail-modal (Codex view)
- [ ] Flavor does NOT appear on the card face in card-hand (only in
      tooltip)
- [ ] Flavor does NOT appear in pile-inspector / card-draft /
      library tile (intentional — detail surfaces only)

## Flavor readability

- [ ] At 50% opacity, flavor is readable but doesn't compete with
      description text
- [ ] If 50% opacity is too faint in any specific surface (e.g.,
      against a busy backdrop), flag for bumping to 60-65% in the
      `--card-flavor-color` token
- [ ] Italic style differentiates from upright description

## Voice spot-check

- [ ] Read 5 random cards across archetypes — does the voice feel
      consistent? Military-industrial-with-sci-fi-accents register
- [ ] Cartographer cards: surveyor/explorer voice ("The path is
      whatever the map says it is.")
- [ ] Highground cards: climber/sentinel voice ("From above, the
      battle is always smaller.")
- [ ] Conduit cards: engineer/network voice ("Two conduits make a
      pair. Three make a network.")
- [ ] H3 keyword cards: keyword-as-metaphor (PHANTOM_GOLD:
      "Spend it before it forgets to exist.")

## Honest line revisions to verify

These 3 lines were flagged by the writing agent — confirm whether
they read OK in real card context or need revision:

- [ ] CLIFFSIDE — "A horizontal ridge. The towers look down the
      barrel." Does "down the barrel" read as towers ABOVE the
      action (correct) or AT the wrong end of a gun (incorrect)?
- [ ] COLLAPSE — "The ground does not care about their schedule."
      Functional but dry; could be more cartographer-voiced.
- [ ] GRAVITY_WELL — "A trench is only a disadvantage if you dug
      it wrong." Borderline quippy for the register.

