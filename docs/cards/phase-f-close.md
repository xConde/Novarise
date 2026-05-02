# Card Branding — Phase F Close

Branch: `feat/card-branding`. Phase F ran sprints S52+S53 (card-detail
modals) and S55-S57 (cross-component + responsive). Surface propagation
complete.

## Sprints shipped

| Sprint | Subject | Commit |
|---|---|---|
| S52+S53 | Card-detail modals upgraded to branding parity | 9d12f9c |
| S55-S57 | Cross-component integration + responsive audit | 92b0c52 |
| S58 | Phase F close (this commit) | — |

3 commits this phase. 7547 → 7718 specs (+171 net).

Note: S49-S51 (pile inspector / card-draft / library tile rebuilds) were
already done across phases A-E; the plan-doc Phase F sprint allocations
overlapped with earlier work. Phase F captured what was actually
remaining: in-game card-detail modal upgrade + library card-detail-modal
parity + cross-surface verification.

## What ships

### Card-detail modals at parity

Both detail modals now carry the established card identity vocabulary:

**In-game card-detail modal** (right-click on card):
- Was pure text — no branding
- Now: archetype trim ring, 3.5rem art-zone strip with backdrop pattern,
  archetype sub-icon glyph, tower footprint preview, keyword icon badges
  (replacing text labels), inline `{kw-*}` icons in description (carried
  from S37)

**Library card-detail-modal** (Codex deep-dive):
- Had partial S27 trim/backdrop
- Now: full parity — added trim ring (stacked into existing box-shadow),
  2.5rem art-strip, archetype sub-icon, tower footprint, keyword icon
  badges

### Honest design choice (S52+S53)

`clip-path` polygon was NOT applied to either modal. Both are wide
vertical info panels, not card-shaped. Forcing a polygon onto a
non-card layout would clip rounded corners and look broken. Art-zone
strip + trim ring is the correct adaptation — same identity signals,
different geometry.

### Cross-component verification (S55)

New `card-branding.integration.spec.ts` iterates 12 representative cards
across archetype × type × rarity space and asserts 5 binding paths per
card per surface. Zero binding fall-through bugs found. All 4 archetypes
propagate correctly to all surfaces.

8 gap-fill specs added to `library-card-tile.component.spec.ts` covering
cartographer + highground archetypes that previously had only conduit
DOM-level coverage.

### Content matrix observation (not a bug)

The integration audit surfaced that several archetype × type
combinations don't exist in `CARD_DEFINITIONS`:
- cartographer-tower
- cartographer-utility
- highground-tower
- highground-utility
- conduit-spell

These are content gaps — design-side decisions about what card slots are
filled — not branding failures.

### Responsive audit (S56+S57)

All 6 surfaces audited at mobile (≤480px) and tablet (≤768px). Clean
across the board. All S39/S41 mobile suppressions confirmed:
- `.card__archetype-glyph` hidden at 480px
- `.card__footprint` hidden at 480px
- `.card__keywords` hidden at 480px

No responsive CSS fixes needed. No new tokens added.

## Specs added

+171 net across the phase:
- card-detail.component (+11)
- card-detail-modal.component (+11)
- card-branding.integration spec (+152, the cross-surface coverage matrix)

## Browser-smoke items added to checklist

The agent honestly flagged one item that requires real-browser
inspection (Karma cannot judge):

- **Tower clip-path battlements at 3.75rem mobile width.** The notches
  are ~5px at this scale — function correctly but readability is a
  design call. If they read as visual noise rather than battlements,
  Phase H polish should suppress the polygon at mobile and fall back
  to a flat rectangle on Tower mobile cards.

## Architecture invariants now in place

After Phase F, the card branding system is structurally complete across
6 surfaces. Future work (Phase G flavor, Phase H polish) extends the
existing patterns rather than adding new infrastructure.

The system has these layers:

1. **Frame silhouette** (Phase B) — clip-path polygon per card type.
   Card-hand, library-tile, card-draft. NOT applied to modal panels
   (intentional — modal layout doesn't fit card shape).
2. **Archetype trim** (Phase C, S21) — 2-3px inset box-shadow ring in
   archetype color. Card-hand, pile-inspector, library-tile, both
   modals.
3. **Archetype backdrop** (Phase C, S22-S25) — SVG pattern in art zone.
   Card-hand, library-tile, both modals.
4. **Archetype sub-icon** (Phase D, S39) — 24px corner accent. Card-hand,
   both modals. NOT in pile-inspector or card-draft (intentional).
5. **Keyword icon badges** (Phase D, S36) — 14px badges per active
   keyword flag. Card-hand, both modals.
6. **Inline keyword icons in description** (Phase D, S37) — `{kw-*}`
   token parser. Card-hand tooltip, both modals.
7. **Tower footprint preview** (Phase E, S41-S43) — 1.2rem hand /
   1.5rem tile/draft outlined square. Card-hand, library-tile,
   card-draft, both modals. NOT in pile-inspector (skipped — row
   clutter).

## Carry-forward into Phase G

Phase G adds `flavorText` to CardDefinition + writes 74 flavor lines.
Display in tooltip + detail modal + library only — NOT in-hand
(would compete with mechanics text).

The `<app-description-text>` component already handles inline {kw-*}
parsing; can be reused for flavor display since flavor strings won't
contain {kw-*} tokens but the parser handles plain strings as a no-op.

## What this phase did NOT do

- No flavor text. Phase G.
- No animation polish per rarity. Phase H.
- No motion budget changes. Phase H.
- No content additions (the "missing archetype × type combinations"
  observation is not actionable in a branding branch).
