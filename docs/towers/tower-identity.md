# Tower Identity — Names, Niches, Voice

Canonical naming and personality reference for the six tower chassis.
All player-facing tower naming derives from this doc. Content code reads
from `TOWER_IDENTITIES` in `tower.model.ts`; this doc is the design record.

## The model

Towers are **crew nicknames over a formal category**. The world stays
military-industrial (the established card voice); the nicknames are what
the field crew actually calls the hardware. Lighter than the spec callsigns,
never jokey in stat lines.

Display pattern everywhere: **`Name · Category`** (e.g. `Pip · Basic`).
Cards drop the word "Tower" — the footprint glyph and silhouette already
say it. The L3 specializations (Marksman, Glacier, Tesla…) are unchanged:
they are *earned callsigns* — Pip grows up into a Marksman.

`TowerType` enum values are serialized in checkpoints and MUST NOT change.
Display names only.

## The six

| Type | Name | Niche (2-3 traits) | Card flavor (canon) |
|---|---|---|---|
| BASIC | **Pip** | First hire. Proud of being unremarkable. Never misses a shift. | "First on the wall. Last to complain." |
| SNIPER | **Magpie** | Collects far-off shinies. Dramatic about distance. Every kill is a trophy. | "Anything shiny within a mile is legally Magpie's." |
| SPLASH | **Confetti** | Overenthusiastic. Every problem looks like a party. The answer is always more radius. | "Every problem looks like an invitation." |
| SLOW | **Lull** | Unbothered. Zen. The calm spot in the lane — nothing hurries near it. | "Nothing hurries past. Nothing hurries near." |
| CHAIN | **Zigzag** | Improviser. Show-off. Never plays the same arc twice. | "Never plays the same solo twice." |
| MORTAR | **Kettle** | Patient. Whistles before it boils over. Tends its burn zones like a garden. | "Listen for the whistle. Then leave." |

## Voice rules

1. Nicknames are warm; the world is not. Flavor text may wink; tooltips and
   stat lines stay function-first (one personality clause max, at the end).
2. Never refer to a tower as "he/she" — towers are "it" / by name.
3. Spec descriptions (Marksman, Glacier…) keep their existing serious
   register — the contrast is the point.
4. Variant cards (Reinforced Basic, Light Sniper, Splash Cluster, Slow
   Aura…) keep functional names for now; they read as gear variants of the
   chassis. Their flavor may reference the nickname.

## Tooltip descriptions (TOWER_DESCRIPTIONS canon)

- BASIC: `Steady single-target fire. Pip takes every shift.`
- SNIPER: `Long range, high damage, slow fire. Magpie claims its trophies.`
- SPLASH: `Area damage in a radius. Confetti brings the party.`
- SLOW: `Slows enemies, deals no damage. Lull keeps the lane calm.`
- CHAIN: `Lightning bounces between enemies. Zigzag improvises the path.`
- MORTAR: `Burning damage zones. Kettle whistles first.`

## Surfaces (where names render)

- `card-definitions.ts` — 6 base tower card names + flavorText
- `tower-info-panel.component.html` — selected-tower header + MAX spec line
- `game-board.component.html` — touch-placement ghost label + aria-label
- `profile.component.ts` — kill-stat row labels
- `tower-info.model.ts` — `TOWER_INFO` (orphaned encyclopedia model; now
  derives from `TOWER_IDENTITIES`)

## Shot personality (projectile idioms)

Config-only alignment; no new meshes, no color changes (colorblind assist
shipped in PR #41 — projectile hues are accessibility surface, not flavor).
Conservative tuning (≤30% on durations/sizes) and only where it reinforces
the niche:

- Magpie (HITSCAN): the shot is the trophy moment — fade may linger slightly.
- Confetti (SPLASH): impact ring is the party — travel stays snappy.
- Zigzag (CHAIN): arc jitter is the solo — bounce timing may vary subtly
  within existing config bounds.
- Pip / Lull / Kettle: no changes unless an audit finds a readability win.
