# Card Branding — Branch Close (permanent record)

Branch: `feat/card-branding`. Cut from `main` 2026-04-30 at commit
87b8a64 (PR #35 merge). Closed and ready for merge after 70 sprints
across 8 phases.

This is the permanent record — kickoff plan docs and per-phase memory
docs can be retired. The PR body and this file are the canonical
summary.

## Counts

- 40 commits ahead of `main`
- 7374 → 7736 SUCCESS / 0 FAILED / 1 skipped (**+362 specs**)
- 0 spec regressions across the entire branch
- 0 build failures across the entire branch

## What this branch shipped

A complete UI/UX card branding system spanning 6 card surfaces. Each
card now carries up to 7 layered identity signals:

1. **Frame silhouette** (clip-path polygon per card type)
2. **Archetype trim ring** (inset box-shadow in archetype color)
3. **Archetype backdrop pattern** (SVG texture in art zone)
4. **Archetype sub-icon glyph** (24px corner accent)
5. **Keyword icon badges** (replacing letter glyphs)
6. **Inline `{kw-*}` icons in description text**
7. **Tower footprint preview** (tower cards only)
8. **Flavor text** (detail surfaces only)

## Phase A — Foundation (S1-S8)

5 commits. No visual changes. Substrate work:
- 79 design tokens in new `src/styles/_card-tokens.scss`
- 7 SCSS files rewired to consume tokens (~120 references)
- `CardDefinition.archetype` promoted to required (touched all 74 cards)
- 11 cards renamed for legibility (Iron Will → Far Sight, Battle Surge
  → Emergency Orders, Advance Guard → Forward Pay, etc.)
- 5 prefers-reduced-motion blocks added
- Dead-card audit found 0 dead IDs (74↔74 enforced at compile time)

Notable finding: the earlier "135 enum / 74 definitions" gap was a
Haiku miscount; reinforced the no-Haiku-agents rule.

## Phase B — Frame silhouettes (S9-S18)

9 commits, +37 specs. First user-visible work.

4 distinct silhouettes via clip-path + filter:drop-shadow:
- **Tower** — battlement notches at top corners
- **Spell** — center peak with tapered shoulders
- **Modifier** — 8-vertex octagonal medallion
- **Utility** — bilateral chevron on lower-mid

Architecture decisions locked:
- `box-shadow: inset` for trim layer (Phase C will use this)
- `filter: drop-shadow` for rarity glow (follows clip-path; box-shadow
  doesn't)
- 8px max blur clamp via `min(var, max)`
- Per-type pending pulse keyframes (animate composed filter)

Surfaces propagated: card-hand, library-card-tile, pile-inspector
(20px shape badges), card-draft.

## Phase C — Archetype identity (S19-S28)

5 commits, +27 specs. Cartographer / Highground / Conduit cards finally
diverge visually from Neutral.

Hue-distance audited trim palette:
- Cartographer #4a9a72 (155° green-teal)
- Highground #b8724a (22° terracotta)
- Conduit #7a6ab8 (258° pure violet)
- Neutral #7a7a88 (charcoal-silver)

4 SVG backdrop patterns:
- Cartographer: 3 Bézier survey lines
- Highground: 3 concentric ellipses (peak from above)
- Conduit: H+V crosshair + 5 nodes (most legible)
- Neutral: 45° cross-hatch (quietest)

Mid-phase correction: replaced an over-broad
`box-shadow: none !important` on framed library tiles with proper
inset trim + filter:drop-shadow split (was a Phase B oversight).

## Phase D — Keyword vocabulary (S29-S40)

7 commits, +37 specs. Largest icon work.

14 SVG icons sharing one geometric vocabulary (24×24 viewBox, stroke
1.5, currentColor, round line caps):
- 6 keyword icons: terraform, link, exhaust, retain, innate, ethereal
- 4 type icons (refreshed): crosshair, bolt, shield, gear
- 4 archetype sub-icons: arch-cartographer (compass), arch-highground
  (peaks), arch-conduit (3-node), arch-neutral (crosshatch X)

DescriptionTextComponent — new standalone Angular component. Parses
`{kw-name}` tokens via regex; renders mixed text + inline icons. Wired
into 3 surfaces (card-hand tooltip, both detail modals).

30 description strings updated to use tokens. terraform / link land at
zero — those keywords are integrated into effect text rather than
appearing as trailing keyword sentences. Honest finding.

## Phase E — Tower footprint (rescoped, S41-S48)

3 commits, +13 specs. Phase rescoped mid-flight from 8 to 3 sprints.

Tower footprint glyph — small outlined square at bottom-center on
tower cards. Color via `var(--card-tower-accent)` so per-tower-type
accent flows. Surfaces: card-hand (1.2rem), library-tile (1.5rem),
card-draft (1.5rem). Suppressed on mobile.

**Honest scope cut:** S44-S47 (modifier active-state chips on 3D
towers) deferred outside this branch. Game-state UX, not card branding.
Belongs in a separate `feat/board-status-chips` branch.

## Phase F — Surface propagation (S49-S58)

3 commits, +171 specs. Largest spec bump (cross-component integration
spec landed 152 specs).

Both card-detail modals (in-game + library Codex) brought to branding
parity:
- Archetype trim ring
- 3.5rem (in-game) / 2.5rem (library) art-zone strip with backdrop
- Archetype sub-icon
- Tower footprint
- Keyword icon badges
- Inline {kw-*} icons (carried from S37)

Honest design call: NO clip-path polygon on modals. They're wide
vertical info panels, not card-shaped. Forcing a polygon would clip
rounded corners and look broken. Art-zone strip + trim ring is the
right adaptation — same identity signals, different geometry.

Cross-component integration spec (`card-branding.integration.spec.ts`)
iterates 12 representative cards × 6 surfaces × 5 binding-path
assertions (152 specs). Caught and gap-filled previously-untested
cartographer/highground DOM bindings in library-card-tile.

Responsive audit clean across all 6 surfaces at mobile + tablet
breakpoints. No CSS fixes needed.

Content matrix observation (not a bug): cartographer-tower,
cartographer-utility, highground-tower, highground-utility, and
conduit-spell card combinations don't exist in CARD_DEFINITIONS.

## Phase G — Flavor text (S59-S66)

3 commits, +18 specs.

`CardDefinition.flavorText?: string` (max 80 chars enforced at spec
level). 74 lines written in single creative pass for voice coherence.

Voice register: military-industrial with sci-fi accents (per the
Phase A naming-audit finding). Per-archetype briefs:
- Cartographer: surveyor / cartographer / explorer
- Highground: climber / sentinel / mountain
- Conduit: engineer / network / circuit
- Neutral: tactical / artillery / standing-orders

Display in 3 detail surfaces (card-hand tooltip + both modals). NOT in
hand, pile-inspector, card-draft, or library tile. Italic 0.7rem 50%-
opacity straight-quote-wrapped styling.

3 lines flagged for follow-up review (CLIFFSIDE idiom, COLLAPSE
dryness, GRAVITY_WELL quippiness). Individual revisions, not systemic.

## Phase H — Audits + close (S67-S72)

2 commits. Mostly verification.

3 real reduce-motion bugs caught and fixed: pile-inspector,
card-detail-modal, card-draft all had `@media (prefers-reduced-motion)`
gates but were missing the in-game `body.reduce-motion` class fallback.
Pattern lesson: every new surface with a keyframe needs BOTH paths.

Rarity animation budget audit: clean across all 6 surfaces (commons
static, uncommons no ambient, rares one ambient). Plan budget honored.

DescriptionTextComponent disposal audit: clean (no subscriptions,
listeners, timers, or pools).

## Architecture invariants

Future card-branding work extending this system should respect:

1. **CSS-var indirection** for visual properties. Component binds
   `[style.--archetype-trim-color]`; SCSS reads `var(...)`.
2. **Inset vs filter shadow split.** `box-shadow: inset` for inner trim;
   `filter: drop-shadow` for outer glow. They coexist on framed cards.
3. **Per-type pending keyframes.** The shared box-shadow keyframe is
   invisible under clip-path; framed cards animate filter instead.
4. **Two-class specificity over !important.** Composing trim + frame +
   rarity layers via specificity, not bang-important.
5. **Hand vs tile aspect-variant tokens.** Surfaces with different
   aspect ratios get separate clip-path tokens.
6. **Reduce-motion needs two paths.** `@media (prefers-reduced-motion)`
   for OS-level + `body.reduce-motion` class for in-game settings.

## Browser smoke checklist

`docs/cards/browser-smoke-checklist.md` carries 60+ items across the
8 phases. The honest items needing browser eyeball:

- Tower clip-path battlements at 3.75rem mobile (5px notches —
  readable as battlements, or visual noise?)
- Cartographer compass sub-icon at 50% opacity (8 ticks vs visual
  smear)
- Decorative density on rare cartographer/highground cards (multiple
  archetype signals stacking)
- bolt type icon at 12px in tooltip (stroked polyline vs old filled
  silhouette)
- Modifier-Utility fan seam at 10-card density
- Flavor text 50% opacity legibility in busy modal contexts

## Deferred

Items deliberately deferred outside this branch:

1. Modifier active-state chips on 3D towers — separate branch
2. Card-draft archetype trim/backdrop — separate sprint (no archetype
   wiring in card-draft component)
3. Pile-inspector backdrop pattern — illegible at row scale
4. 3 flavor lines (CLIFFSIDE / COLLAPSE / GRAVITY_WELL) — minor revisions
5. Tower mobile battlement readability — design call awaiting smoke
6. Card-detail modal upgrade-preview block sub-icon — Phase H polish
7. Per-archetype radial gradient on modal art strips — Phase H polish
8. Siegeworks archetype rendering — deferred to Phase 5 elsewhere

## Lessons learned (worth carrying forward)

1. **Honest scope cuts mid-phase are cheap.** Phase E rescoped from
   8 sprints to 3 because S44-S47 were game-state UX, not card
   branding.
2. **Bundling sprints works when scope is shared.** S22-S25 (4 archetype
   backdrops), S29-S34 (6 keyword icons), S60-S65 (74 flavor lines) all
   bundled cleanly. S21 (single design call) needed its own focus.
3. **Hue-distance audits prevent fights.** Phase C's cartographer trim
   was pulled from blue-teal toward green specifically to widen
   separation from Conduit (60° → 103°) and Highground was pushed to
   terracotta to clear rare gold (24° → 38°).
4. **Type-level enforcement beats convention.** Phase A made
   `archetype` required; surfaced 51 implicit-defaults that would have
   been Phase C visual surprises if left until then.
5. **Cross-component integration specs catch what unit specs miss.**
   The S55 integration spec landed 152 specs and found
   previously-untested DOM bindings.
6. **Single-pass mass writes preserve voice.** S60-S65 wrote 74 flavor
   lines in one agent call rather than 6 separate sprints; voice
   stayed unified.
7. **Karma can't see pixels.** Every visual quality assertion that
   survived was backed by a documented browser-smoke item. Build
   browser-smoke as you go, not at the end.

## Plan vs reality

Plan: 72 sprints across 8 phases. Reality: 70 sprints (Phase E rescoped
8 → 3, but other phases bundled and executed efficiently). Plan
estimated 3 weeks; reality was a single session.
