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
