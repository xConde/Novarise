# Dead Card Audit (S1)

Generated: 2026-04-30 on feat/card-branding.

## Summary

- Total `CardId` enum entries: **74**
- Total `CARD_DEFINITIONS` entries: **74**
- Unmapped: **0**
  - DEAD: 0
  - TEST-ONLY: 0
  - DEFERRED: 0
  - ORPHAN-CODE: 0

**The prior recon count of "135 enum / 74 definitions" was incorrect.** The enum and
`CARD_DEFINITIONS` are in exact 1-to-1 correspondence. `CARD_DEFINITIONS` is typed as
`Record<CardId, CardDefinition>` — TypeScript enforces exhaustiveness at compile time.
`card-definitions.spec.ts` line 17 additionally asserts
`Object.keys(CARD_DEFINITIONS).length).toBe(74)` and line 21–23 iterate every `CardId`
value and assert a definition exists. No dead, orphaned, or deferred-without-definition
IDs exist.

**No P0 ORPHAN-CODE cases.** All 74 CardIds have a definition and are reachable via
`buildNonStarterCardPool()` → `Object.values(CARD_DEFINITIONS)` in `run.service.ts`.

---

## Mapped (in CARD_DEFINITIONS) — all 74

Grouped by archetype/category as they appear in the enum.

### Tower Cards (12)
`TOWER_BASIC` · `TOWER_SNIPER` · `TOWER_SPLASH` · `TOWER_SLOW` · `TOWER_CHAIN` · `TOWER_MORTAR`
`TOWER_BASIC_REINFORCED` · `TOWER_SNIPER_LIGHT` · `TOWER_SPLASH_CLUSTER` · `TOWER_SLOW_AURA` · `TOWER_CHAIN_TESLA` · `TOWER_MORTAR_BARRAGE`

### Neutral Spell Cards (10)
`GOLD_RUSH` · `REPAIR_WALLS` · `SCOUT_AHEAD` · `LIGHTNING_STRIKE` · `FROST_WAVE` · `SALVAGE` · `FORTIFY` · `OVERCLOCK` · `DETONATE` · `EPIDEMIC`

### Status Spell Cards (3)
`INCINERATE` · `TOXIC_SPRAY` · `CRYO_PULSE`

### Neutral Modifier Cards (8)
`DAMAGE_BOOST` · `RANGE_EXTEND` · `RAPID_FIRE` · `ENEMY_SLOW` · `GOLD_INTEREST` · `SHIELD_WALL` · `CHAIN_LIGHTNING` · `PRECISION`

### Neutral Utility Cards (3)
`DRAW_TWO` · `RECYCLE` · `ENERGY_SURGE`

### H3 Keyword Cards — exhaust (4)
`LAST_STAND` · `OVERLOAD` · `BATTLE_SURGE` · `IRON_WILL`

### H3 Keyword Cards — retain (4)
`STOCKPILE` · `WAR_FUND` · `VANGUARD` · `BULWARK`

### H3 Keyword Cards — innate (4)
`OPENING_GAMBIT` · `SCOUT_ELITE` · `ADVANCE_GUARD` · `FIRST_BLOOD`

### H3 Keyword Cards — ethereal (3)
`DESPERATE_MEASURES` · `WARP_STRIKE` · `PHANTOM_GOLD`

### Cartographer Archetype (7)
`LAY_TILE` · `BLOCK_PASSAGE` · `DETOUR` · `BRIDGEHEAD` · `COLLAPSE` · `CARTOGRAPHER_SEAL` · `LABYRINTH_MIND`

### Highground Archetype (8)
`RAISE_PLATFORM` · `DEPRESS_TILE` · `HIGH_PERCH` · `CLIFFSIDE` · `VANTAGE_POINT` · `AVALANCHE_ORDER` · `KING_OF_THE_HILL` · `GRAVITY_WELL`

### Conduit Archetype (8)
`HANDSHAKE` · `FORMATION` · `LINKWORK` · `HARMONIC` · `GRID_SURGE` · `CONDUIT_BRIDGE` · `ARCHITECT` · `HIVE_MIND`

---

## Unmapped — DEAD

None.

---

## Unmapped — TEST-ONLY

None.

---

## Unmapped — DEFERRED

None.

---

## Unmapped — ORPHAN-CODE (P0 — investigate)

None.

---

## Observation: Cards with no dedicated spec coverage

These 22 cards have definitions and are reachable via the reward pool, but no spec
file exercises them by CardId. They are NOT bugs — they are covered indirectly by
the exhaustive `Record<CardId, CardDefinition>` check in `card-definitions.spec.ts`.
However, their runtime behavior (effects, upgrades, interactions) has zero explicit
test assertions beyond the structural field-shape checks.

This is the real coverage gap for the card branding sprint series. S2 should treat
this table as a test-debt inventory, not a deletion list.

| CardId | Category | Rarity | Notes |
|---|---|---|---|
| `ADVANCE_GUARD` | H3 innate | COMMON | +30g on encounter start |
| `BATTLE_SURGE` | H3 exhaust | COMMON | draw 3 on exhaust |
| `BULWARK` | H3 retain | UNCOMMON | +25% range for 3 waves, retain |
| `CHAIN_LIGHTNING` | Modifier | UNCOMMON | +2 chain bounces for 2 waves |
| `DESPERATE_MEASURES` | H3 ethereal | UNCOMMON | restore 3 lives, ethereal |
| `ENEMY_SLOW` | Modifier | COMMON | −15% enemy speed for 3 waves |
| `FIRST_BLOOD` | H3 innate | UNCOMMON | deal 60 dmg to first enemy this wave |
| `GOLD_INTEREST` | Modifier | UNCOMMON | 50% gold interest for 2 waves |
| `GRID_SURGE` | Conduit | UNCOMMON | ×2 dmg for towers with ≥4 neighbors, 1 turn |
| `HARMONIC` | Conduit | UNCOMMON | flag modifier, 3 turns |
| `IRON_WILL` | H3 exhaust | UNCOMMON | +40% range for 3 waves, exhaust |
| `LAST_STAND` | H3 exhaust | COMMON | restore 5 lives, exhaust |
| `LINKWORK` | Conduit | COMMON | 0E, flag modifier, 2 turns |
| `OPENING_GAMBIT` | H3 innate | COMMON | draw 2 at encounter start, innate |
| `OVERLOAD` | H3 exhaust | UNCOMMON | +50% dmg for 2 waves, exhaust |
| `PHANTOM_GOLD` | H3 ethereal | COMMON | gain 50g, ethereal |
| `PRECISION` | Modifier | UNCOMMON | +50% crit chance for 2 waves |
| `RECYCLE` | Utility | COMMON | discard 1, draw 1 |
| `STOCKPILE` | H3 retain | COMMON | gain 1E next turn, retain |
| `VANGUARD` | H3 retain | UNCOMMON | +30% dmg for 3 waves, retain |
| `WAR_FUND` | H3 retain | COMMON | gain 25g, retain |
| `WARP_STRIKE` | H3 ethereal | UNCOMMON | deal 80 dmg to random enemy, ethereal |

---

## S2 Action Plan

### Corrected scope for S2

The original S2 scope (mass deletion) does not apply — there are no dead IDs.
The actual work for S2 should be:

**No deletions.** All 74 CardIds are valid, mapped, and reachable.

**No "keep with comment" additions.** No deferred IDs are in the enum without a
definition. The Siegeworks `anchor` keyword note in `card.model.ts` line 234 is
correct and sufficient.

**Recommended S2 pivot: test coverage for the 22 uncovered cards.**
Add a single spec block in `card-definitions.spec.ts` (or a new `card-effects.spec.ts`)
that exercises each of the 22 cards above with at minimum:
1. `CardEffectService` apply call (or equivalent) verifying the effect fires.
2. Upgraded variant behavior check.

This work can be batched by category (H3 keyword group, Modifier group, Conduit group)
across 3–4 sub-sprints.

**Recommended S2 comment fix: stale doc comment.**
`card-definitions.ts` line 4 says "All 25 cards defined" — should read "All 74 cards
defined." Fix in passing during S2.
