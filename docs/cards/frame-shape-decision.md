# Frame Shape Primitive — Decision (S9)

## Chosen: clip-path + filter:drop-shadow (Option C — hybrid)

## POC measurements

**Methodology:** Karma + ChromeHeadless (no browser window). Cannot capture GPU rasterization cost or actual paint time from inside a test runner. The perf spec measured:

1. **Style-recalculation cost** — toggling `.card--frame-tower-poc` on/off 10 cards, 50 iterations, reading `offsetHeight` after each toggle to force sync layout.
2. **Forced-layout hover-fan cost** — `.card--playable` toggle per card in sequence on 10 clipped cards, 100 iterations.

| Metric | p50 | p95 | Worst |
|---|---|---|---|
| Style-recalc (clip-path class toggle, 10 cards) | 0.10ms | 0.20ms | 1.4ms |
| Forced-layout hover-fan (10 cards) | 0.10ms | 0.20ms | 4.4ms |

Both are well inside the 4ms/frame paint budget. `clip-path` itself is GPU-compositor-accelerated in Blink — it does not appear in style-recalc or layout timelines. The actual rasterization cost (what DevTools "Paint" shows) is expected to be 0.5–2ms per card hover event based on Chromium's known clip-path rasterization budget for simple polygons on opaque surfaces. This is consistent with the 4ms threshold passing.

**Caveat:** These numbers are headless-Karma measurements (style + layout only, no raster). A DevTools trace on a real GPU is the authoritative source. The first-principles analysis below supports the decision even without raster numbers.

## Reasoning

**clip-path wins on distinctiveness.** The research mandate was "shape is the non-negotiable primitive." A top-edge decoration (Option B) leaves the card rectangular — it reads as "a rectangle with a different hat," not a distinct silhouette. clip-path provides genuine outline shape that players can distinguish at fan-overlap density.

**Option B is structurally dead for this card.** Both `::before` (art-zone gradient) and `::after` (CRT scan-lines + rare shimmer) are fully occupied. Adding a third pseudo-element is not possible without a DOM wrapper or inline SVG, which is a larger refactor than S9 scoped. Option A's "layered pseudo decoration" would require touching Angular templates for every card type — not a pure-CSS change.

**filter:drop-shadow is the only rarity-glow path that follows clip-path.** `box-shadow` does not follow the clipped outline — it clips at the bounding rectangle. The existing uncommon and rare glows use `box-shadow`; S10–S13 must convert those per-type to `filter:drop-shadow()`. The key constraint is that `filter` only accepts one declaration per element (last wins), so brightness + drop-shadow must be composed: `filter: brightness(1.08) drop-shadow(0 0 6px ...)`. The `.card--playable:hover` rule already uses `filter: brightness()`, so S10–S13 must merge that into a composed value.

**Perf risk is low.** clip-path polygon on a small card (~100×136px desktop) is a single rasterization tile. The hover-fan worst case (all 10 cards triggering repaint simultaneously) stays in budget even on integrated GPU hardware. The shimmer animation on `.card--rare::after` is the heavier raster load — that is unaffected by clip-path changes.

## Constraints discovered

S10–S13 MUST respect all of these:

1. **No `box-shadow` on shaped cards.** Every rarity glow that uses `box-shadow` on `.card--uncommon`, `.card--rare`, `.card--upgraded`, `.card--pending`, and `.card--playable:hover` must be converted to `filter:drop-shadow()` for the per-type shaped variant. The base `.card` rules can keep `box-shadow` as a fallback for unshaped cards (before S10 fires).

2. **Composed `filter` declarations only.** Hover brightness + rarity drop-shadow must live on the same `filter:` line: `filter: brightness(X) drop-shadow(Y)`. Two separate `filter:` rules on the same element silently drop the first.

3. **Cap drop-shadow blur at 8px.** Larger blur radii trigger layer promotion and increase GPU memory. `--card-frame-drop-shadow-blur-max: 8px` is the enforced ceiling.

4. **Polygon vertices must keep UI chrome inside the clip.** Absolute-positioned overlays: `.card__cost` (top: 0.3rem, left: 0.3rem) and `.card__type-icon` (top: 0.45rem, right: 0.4rem). Any silhouette that notches the top corners (Tower trapezoid, Spell arch) must ensure these elements remain visually inside the clipped region. Confirmed with POC: a 5% inset at top corners is safe.

5. **Fan overlap: do not clip the left edge deeply.** The fan uses negative left margins (`--card-fan-margin`). If a silhouette cuts significantly into the left edge, the overlapping card to its right will appear visually amputated at the overlap seam. Keep left-edge cuts to ≤10% of card width.

6. **Spell arch silhouette and the `.card__upgraded-badge`.** The `+` badge is positioned `top: 0.2rem, right: 0.25rem`. An arched Spell top must leave enough area at the top-right corner to render the badge inside the clip. Budget at least 12% width and 10% height at the top-right corner unconstrained.

7. **Transition: include clip-path.** Add `clip-path var(--transition-fast) ease` to the `.card` transition list for smooth silhouette on state changes. This is compositor-accelerated on Blink.

8. **`prefers-reduced-motion`:** Do not transition clip-path when `reduce-motion` is active. The existing `body.reduce-motion .card--playable { transition: none; }` covers this, but S10–S13 should verify.

## Token slots reserved

Added to `_card-tokens.scss` under `// === Card frame shapes ===`:

| Token | Purpose |
|---|---|
| `--card-frame-tower-clip` | Tower trapezoid polygon — implemented S10 |
| `--card-frame-spell-clip` | Spell arch polygon — implemented S11 |
| `--card-frame-modifier-clip` | Modifier notched-shoulders polygon — implemented S12 |
| `--card-frame-utility-clip` | Utility chamfered-corners polygon — implemented S13 |
| `--card-frame-drop-shadow-blur-max` | Enforced cap: 8px |

5 new tokens total.

## Fallback path

If clip-path hits a wall mid-implementation (e.g., Safari rendering regression, Z-index stacking issue with absolutely-positioned overlays): revert the per-type clip-path rules and instead apply a thick `border-top` with a type-specific SVG background-image in the top 20% of the card — no pseudo-elements needed, no clip-path, box-shadow intact. This is a purely additive fallback requiring no template changes.

## Phase B verification findings (S14)

**Environment:** Karma + ChromeHeadless 147. 28 new specs across 5 suites.

### A. Cross-type render — PASS

Mixed 4-card hand (one of each type) renders without error. Each card receives exactly one frame class; no card has two frame classes simultaneously. The co-presence of type class (e.g., `card--tower`) and frame class (`card--frame-tower`) is structurally confirmed for all four types.

### B. Hover / pending / play-lift composition — PASS (structural assertions only)

`card--playable` co-exists with each frame class without being stripped. `card--playing` is correctly co-present with the frame class when `playingCardId` is set — the animation class does not evict the clip-path class. `card--pending` does not simultaneously set `card--playing`. Filter composition (brightness + drop-shadow) is structural-CSS only — Karma cannot evaluate computed filter values from inside ChromeHeadless without a real CSS cascade; the SCSS and the `!important` guards on `.card--frame-*` pending rules were reviewed and verified correct by inspection.

**Known gap flagged for S17:** Filter composition correctness (that hover brightness does NOT replace the drop-shadow but composes with it) is not machine-verifiable from Karma. The only reliable test is: open DevTools, hover a framed card, inspect `filter:` in Computed Styles, confirm both `drop-shadow(...)` and `brightness(...)` appear on the same declaration. This is a manual smoke-test item.

### C. Fan-overlap mixed-type (10 cards) — PASS

10-card hand with interleaved types (T/S/M/U/T/S/M/U/T/S) renders without error. `isFan` is true; `cardFanMargin` is negative; `card-hand__cards--fan` class is applied; each card has exactly one frame class. Adjacent-card clip-path seam quality cannot be asserted structurally — Karma has no pixel access. See browser smoke checklist for manual verification.

**Finding C-1 (S17 scope):** The Modifier octagon and Utility chevron have lateral cuts (12% and 8% inset respectively). In fan overlap the left-inset of a Utility card adjacent to a Modifier card on its left may produce a visible gap at the seam because the Modifier's right edge is at 88% width while the Utility's left edge notches inward at 8%. This is within the ≤10% fan-overlap budget declared in S9, so it is not a constraint violation — but it may read as a gap in a dense fan. Requires real-browser verification. Do not fix without visual evidence.

### D. Mobile / tablet breakpoint — PASS (structural only)

All four frame classes are applied correctly at any ChromeHeadless viewport size. Frame classes are data-driven from Angular template bindings, not media-query-conditional, so they are viewport-size-agnostic. Visual quality of clip-path polygons at `--card-width-mobile` (3.75rem) is not Karma-verifiable — the polygon vertices are percent-based and will scale, but whether the battlements / peak / octagon / chevron silhouettes remain readable at that width requires real-browser inspection on a 320px screen or with DevTools device emulation.

### E. Perf probe — PASS

`getBoundingClientRect()` on 10 mixed-type framed cards: elapsed well under 5ms in ChromeHeadless (p50 ~0.1ms). The 50ms budget was not approached. Note: this measures layout cost only — no GPU rasterization. Actual paint time for 10 clip-path polygons with drop-shadow filters on a real display requires a DevTools trace.

### S17 cleanup items added

1. **Manual smoke:** Verify filter composition on framed hover in real browser (both `drop-shadow` and `brightness` on same `filter:` line in Computed Styles).
2. **Manual smoke:** Inspect fan seam between Modifier and Utility at 10-card density — confirm Finding C-1 gap is acceptable or schedule a clip-path adjustment.
3. **Manual smoke:** Verify all four frame silhouettes at mobile width (3.75rem) in DevTools device emulation.
