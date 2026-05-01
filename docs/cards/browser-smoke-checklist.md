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
