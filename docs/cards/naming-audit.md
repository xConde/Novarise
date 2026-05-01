# Card Naming Audit (S5)

Generated: 2026-04-30 on feat/card-branding.

## Summary

- Cards audited: 47 neutrals (tower variants + spells + modifiers + utilities + H3 keyword cards)
- Renames recommended: 9
- No-change verdicts: 38
- H3 keyword name-quality breakdown: STRONG: 7 | WEAK: 5 | BAD: 3

---

## Cluster analysis

### Cluster 1 — Gold-gain spells

Cards: GOLD_RUSH (1E, +40g) / WAR_FUND (0E, +25g, retain) / PHANTOM_GOLD (0E, +50g, ethereal) / ADVANCE_GUARD (0E, +30g, innate)

PHANTOM_GOLD is the standout: "phantom" maps directly to ethereal — use it or lose it, the gold evaporates. Strong keyword signal. KEEP.

WAR_FUND names the reserve/timing angle correctly — retain makes sense as "holding funds in reserve." The name also separates itself from GOLD_RUSH by implying patience. KEEP.

GOLD_RUSH is fine as a plain common with no keyword. 1E for 40g is a straightforward transaction; "Rush" implies urgency/speed, not a keyword. KEEP.

ADVANCE_GUARD is the problem. "Advance Guard" evokes a military vanguard/forward unit — there is already a card literally called VANGUARD. The word "guard" implies defense. The card is an innate gold injector. Nothing in the name signals innate, gold, or encounter-start timing. BAD keyword signal.

**Verdict:** RENAME ADVANCE_GUARD → "Forward Pay". "Forward" borrows military register (advance = forward) while "Pay" signals gold. Together they imply "paid upfront at deployment" — maps cleanly to innate. Separates from VANGUARD without dropping military tone.

---

### Cluster 2 — Heal spells

Cards: REPAIR_WALLS (1E, +2 lives, uncommon) / LAST_STAND (1E, +5 lives, exhaust, rare) / DESPERATE_MEASURES (1E, +3 lives, ethereal, uncommon)

REPAIR_WALLS is the weakest name: it's infrastructure maintenance language, not combat crisis language. There's no "wall" mechanic in the game — lives are represented as HP/leak counters, not wall HP. However, "repair" is not actively misleading, just thematically hollow. At UNCOMMON/common rarity it's a fine throwaway common heal spell name. Borderline KEEP.

LAST_STAND is excellent. "Last stand" is a common idiom for a desperate final effort — maps perfectly to exhaust (one-shot use, gone after). STRONG keyword signal. KEEP.

DESPERATE_MEASURES is also good: "desperate" implies crisis framing, which fits ethereal's "use it now or lose it" pressure. STRONG keyword signal. KEEP.

The three names don't compete: one is a plain heal, one is the big emergency exhaust, one is the smaller use-now ethereal. The value differential (2 / 5 / 3 lives) is meaningful. Register is slightly inconsistent — "Repair Walls" is industrial while the other two are dramatic/military — but the inconsistency is tolerable at common rarity.

**Verdict:** No renames needed. The cluster differentiates adequately and LAST_STAND / DESPERATE_MEASURES both carry their keywords well.

---

### Cluster 3 — Damage-modifier rotation

Cards: DAMAGE_BOOST (+25% dmg, 2 waves, common) / OVERLOAD (+50% dmg, 2 waves, exhaust, rare) / VANGUARD (+30% dmg, 3 waves, retain, uncommon) / RAPID_FIRE (+30% fire rate, 2 waves, uncommon) / IRON_WILL (+40% range, 3 waves, exhaust, uncommon)

DAMAGE_BOOST and RAPID_FIRE: both are "buff tower output" cards. DAMAGE_BOOST is boringly named but unambiguously typed (modifier, damage stat). RAPID_FIRE correctly signals fire-rate, not damage. The distinction is legible. These are plain-register names with no keyword implications needed at common/uncommon rarity. KEEP both.

OVERLOAD: "overload" implies pushing a system past its limit — one-time burst with consequences. Exhaust = pushed past its limit, never used again. STRONG keyword signal. KEEP.

VANGUARD: a vanguard is a lead force, a forward element. The card is a +30% damage modifier with retain. "Retain" means hold in hand until you need it — a vanguard force held in reserve. The name is actually opposite to the behavior in military terms (vanguard = front line, not reserve). However, "Vanguard" is evocative enough and doesn't signal a conflicting keyword. WEAK keyword signal. The real problem is the ADVANCE_GUARD collision: both read as "military forward unit." If ADVANCE_GUARD gets renamed (recommended above), VANGUARD is isolated enough to keep.

IRON_WILL: a range modifier named after willpower/grit. IRON_WILL says "endurance, refusing to back down" — which maps somewhat to exhaust (one final expenditure of will), but "iron will" also suggests a permanent quality, not a one-off burst. The range stat is entirely absent from the name. A player seeing IRON_WILL for the first time will expect a defensive or life-related effect, not a range buff. BAD type-signal.

**Verdict:** RENAME IRON_WILL → "Far Sight". Signals the range stat directly, sounds like a battlefield intel/awareness concept (range = seeing further), fits the military-industrial register. Exhaust is implicit in the rarity/description rather than the name, which is acceptable for a modifier.

Reasons NOT to rename: "Iron Will" is flavorful and memorable. Some players already know it as the range exhaust. Losing the evocative name for a more literal one may feel bland.

---

### Cluster 4 — Draw utilities

Cards: DRAW_TWO (1E, draw 2, common) / RECYCLE (0E, discard hand + draw more, uncommon) / OPENING_GAMBIT (0E, draw 2, innate, uncommon) / BATTLE_SURGE (1E, draw 3, exhaust, uncommon)

DRAW_TWO is the weakest name in the game — it's a placeholder, not a card name. "Draw Two" is what a judge says in a card game rules dispute, not a named card effect. It's the only card in the set named after its mechanical description verbatim. BAD.

RECYCLE is good. Recycle = exchange old hand for new. Correctly signals the discard-then-redraw loop. KEEP.

OPENING_GAMBIT is excellent. "Gambit" implies an opening strategic sacrifice — innate cards are guaranteed in the first hand, before any choice is made. STRONG keyword signal. KEEP.

BATTLE_SURGE is the problematic one flagged in scope: it reads as a spell (surge = burst attack) but is CardType.UTILITY (draw 3). The word "battle" adds to the confusion — players expect damage or combat effect from this name, not card draw. BAD type-signal. Exhaust is not signaled at all.

**Verdict:**
- RENAME DRAW_TWO → "Quick Draw". Military/western register, literal ("draw" cards quickly), upgrades naturally ("Quick Draw" upgrading to draw 3 is coherent). Fixes the placeholder name without changing identity.
- RENAME BATTLE_SURGE → "Emergency Orders". "Emergency" signals exhaust (desperate one-time use), "Orders" signals card/information flow (draw = orders arriving). Separates from combat-spell register. Fits military tone.

Reasons NOT to rename DRAW_TWO: It's transparent. New players immediately understand what it does. Renaming it adds a layer of abstraction. Counter-argument: every other utility name (Recycle, Energy Surge, Stockpile) uses metaphor — Draw Two stands out as inconsistent.

Reasons NOT to rename BATTLE_SURGE: It has brand recognition and sounds exciting. "Emergency Orders" is drier. Counter-argument: brand recognition only matters if the name does the right work.

---

### Cluster 5 — Single-target damage spells

Cards: LIGHTNING_STRIKE (2E, 100 dmg strongest, uncommon) / FIRST_BLOOD (1E, 60 dmg strongest, innate, uncommon) / WARP_STRIKE (2E, 80 dmg strongest, ethereal, rare)

All three deal flat damage to the strongest enemy. The names share "strike" language (Lightning Strike, Warp Strike) — one direct collision.

LIGHTNING_STRIKE is the plain common baseline: no keyword, no special timing. Name is genre-standard TD spell language. KEEP.

WARP_STRIKE: "warp" suggests instantaneous or dimensional travel — which tracks for ethereal (exists briefly, then gone). Weak but acceptable keyword signal. The collision with LIGHTNING_STRIKE on the word "strike" is the real problem. In a card UI list, LIGHTNING_STRIKE and WARP_STRIKE look nearly identical at a glance. WEAK, border-FLAG.

FIRST_BLOOD: excellent. "First blood" means the first wound/kill of a combat — maps to innate perfectly (this is literally always in your opening hand, you strike first). STRONG keyword signal. KEEP.

**Verdict:** RENAME WARP_STRIKE → "Phase Bolt". "Phase" preserves the dimensional/instantaneous register (warp → phase), "Bolt" separates it from "Strike" avoiding the visual collision with LIGHTNING_STRIKE. Ethereal signal is slightly stronger: a phase bolt phases in and phases out.

Reasons NOT to rename: "Warp Strike" is visually distinctive (the word "warp"). The collision with Lightning Strike is at the word level, not at a glance (different icons + art would separate them in practice).

---

### Cluster 6 — Range modifiers

Cards: RANGE_EXTEND (1E, +20% range, 2 waves, modifier, common) / BULWARK (1E, +25% range, 3 waves, retain, modifier, common) / IRON_WILL (2E, +40% range, 3 waves, exhaust, modifier, uncommon)

Three range modifiers with overlapping stat. RANGE_EXTEND is the only one whose name signals the stat (range). BULWARK implies defense/blocking — a bulwark is a fortification, not a sight-line extender. Nothing in "Bulwark" points to range. However, range-as-coverage is loosely defensible: wider range = better defensive coverage. WEAK stat-signal but acceptable by genre convention.

If IRON_WILL is renamed to "Far Sight" (see Cluster 3), this cluster resolves cleanly:
- RANGE_EXTEND: explicit, plain common
- BULWARK: metaphorical defensive coverage, retain (holding the defensive line)
- FAR_SIGHT: range exhaust, more literal signal

**Verdict:** Recommendation already covered under Cluster 3 (IRON_WILL → Far Sight). BULWARK and RANGE_EXTEND: KEEP.

---

### Additional clusters found during audit

#### Tower variant naming inconsistency

The 6 tower variant names follow no consistent naming pattern:
- TOWER_BASIC_REINFORCED → "Reinforced Basic" (adjective + noun)
- TOWER_SNIPER_LIGHT → "Light Sniper" (adjective + noun, reversed order)
- TOWER_SPLASH_CLUSTER → "Cluster Splash" (noun modifier + noun, reversed again)
- TOWER_SLOW_AURA → "Aura Slow" (same reversal)
- TOWER_CHAIN_TESLA → "Tesla Chain" (proper noun + noun)
- TOWER_MORTAR_BARRAGE → "Barrage Mortar" (noun + noun)

The pattern alternates between [Modifier] + [TowerType] and [TowerType] + [Modifier] without logic. "Reinforced Basic" (adjective first) vs "Barrage Mortar" (noun first) vs "Tesla Chain" (brand name). This inconsistency is a mild presentation problem. Sprint 6 should normalize to [Modifier] + [TowerType] throughout: "Reinforced Basic", "Light Sniper", "Cluster Splash", "Aura Slow", "Tesla Chain", "Barrage Mortar" — only two already match this pattern.

Renames: "Cluster Splash" → "Splash Cluster", "Aura Slow" → "Slow Aura", "Tesla Chain" → "Chain Tesla", "Barrage Mortar" → "Mortar Barrage".

Reasons NOT to rename: Order doesn't affect playability. The variants are less important cards. Counter-argument: visual scanning in the shop is worse when the noun order is inconsistent.

#### ENEMY_SLOW: functional description, not a name

"Enemy Slow" is a modifier stat name, not a card name. Like DRAW_TWO, it reads as the internal variable name. The card is a 1E common that slows all enemies for 3 waves. Compare to FROST_WAVE (the spell equivalent) — that card has a proper name. ENEMY_SLOW's name is a placeholder.

**Verdict:** RENAME ENEMY_SLOW → "Heavy Fog". "Fog" implies obscured movement, slow advance; "heavy" implies weight and persistence (3 waves). Keeps the industrial-military register, signals enemy debuff rather than tower buff.

Reasons NOT to rename: Transparency wins with new players. "Enemy Slow" is unambiguous about the effect. Counter-argument: "Frost Wave" isn't transparent either, yet works fine.

#### GOLD_INTEREST: misleading financial metaphor

"Gold Interest" sounds like a bank mechanic (earn interest on held gold). The actual effect is +50% gold from kills for 2 waves — a kill multiplier, not savings interest. A player reading "Gold Interest" expects something triggered by having gold, not by killing enemies.

**Verdict:** RENAME GOLD_INTEREST → "Bounty Orders". "Bounty" maps to "kill reward multiplier" exactly. "Orders" fits military register. "Bounty Orders" reads: "orders issued to pay bounty on kills." Directly matches the +% gold from kills mechanic.

Reasons NOT to rename: "Gold Interest" is memorable and players may already associate it with the mechanic. "Interest" loosely means "benefit from gold" which is close enough. Counter-argument: the bank/savings association is strong enough to actively mislead new players.

---

## Per-card verdicts (full table)

| CardId | Current name | Type | Rarity | Keyword | Verdict | Proposed name | Rationale |
|---|---|---|---|---|---|---|---|
| TOWER_BASIC | Basic Tower | TOWER | STARTER | innate | KEEP | — | Transparent |
| TOWER_SNIPER | Sniper Tower | TOWER | STARTER | — | KEEP | — | Transparent |
| TOWER_SPLASH | Splash Tower | TOWER | STARTER | — | KEEP | — | Transparent |
| TOWER_SLOW | Slow Tower | TOWER | STARTER | — | KEEP | — | Transparent |
| TOWER_CHAIN | Chain Tower | TOWER | STARTER | — | KEEP | — | Transparent |
| TOWER_MORTAR | Mortar Tower | TOWER | UNCOMMON | — | KEEP | — | Transparent |
| TOWER_BASIC_REINFORCED | Reinforced Basic | TOWER | COMMON | — | KEEP | — | Adj+Noun order correct |
| TOWER_SNIPER_LIGHT | Light Sniper | TOWER | COMMON | — | KEEP | — | Adj+Noun order correct |
| TOWER_SPLASH_CLUSTER | Cluster Splash | TOWER | COMMON | — | RENAME | Splash Cluster | Normalize to [Modifier+Tower] order |
| TOWER_SLOW_AURA | Aura Slow | TOWER | COMMON | — | RENAME | Slow Aura | Normalize to [Modifier+Tower] order |
| TOWER_CHAIN_TESLA | Tesla Chain | TOWER | COMMON | — | RENAME | Chain Tesla | Normalize to [Modifier+Tower] order |
| TOWER_MORTAR_BARRAGE | Barrage Mortar | TOWER | COMMON | — | RENAME | Mortar Barrage | Normalize to [Modifier+Tower] order |
| GOLD_RUSH | Gold Rush | SPELL | COMMON | — | KEEP | — | Clear, no competing names nearby |
| REPAIR_WALLS | Repair Walls | SPELL | UNCOMMON | — | KEEP | — | Thematically hollow but unambiguous |
| SCOUT_AHEAD | Scout Ahead | SPELL | COMMON | — | KEEP | — | Clear intel mechanic name |
| LIGHTNING_STRIKE | Lightning Strike | SPELL | UNCOMMON | — | KEEP | — | TD genre staple |
| FROST_WAVE | Frost Wave | SPELL | UNCOMMON | — | KEEP | — | Named + typed correctly |
| SALVAGE | Salvage | SPELL | COMMON | — | KEEP | — | Clean single-word, correct register |
| FORTIFY | Fortify | SPELL | RARE | — | KEEP | — | Upgrade framing is accurate |
| OVERCLOCK | Overclock | SPELL | RARE | — | KEEP | — | Industrial register, fire-rate signal |
| INCINERATE | Incinerate | SPELL | COMMON | — | KEEP | — | Status name is the card name, consistent with DETONATE/EPIDEMIC |
| TOXIC_SPRAY | Toxic Spray | SPELL | UNCOMMON | — | KEEP | — | Delivery vector named correctly |
| CRYO_PULSE | Cryo Pulse | SPELL | COMMON | — | KEEP | — | Sci-fi register; "pulse" signals single-target |
| DETONATE | Detonate | SPELL | COMMON | — | KEEP | — | Payoff name is clear |
| EPIDEMIC | Epidemic | SPELL | COMMON | — | KEEP | — | Poison-spread name is exact |
| DAMAGE_BOOST | Damage Boost | MODIFIER | COMMON | — | KEEP | — | Placeholder-level name but unambiguous |
| RANGE_EXTEND | Range Extend | MODIFIER | COMMON | — | KEEP | — | Same tier as Damage Boost — both transparent |
| RAPID_FIRE | Rapid Fire | MODIFIER | UNCOMMON | — | KEEP | — | Fire-rate modifier, clear |
| ENEMY_SLOW | Enemy Slow | MODIFIER | COMMON | — | RENAME | Heavy Fog | Placeholder name, misleads type as internal variable |
| GOLD_INTEREST | Gold Interest | MODIFIER | COMMON | — | RENAME | Bounty Orders | Misleads: sounds like savings interest, not kill multiplier |
| SHIELD_WALL | Shield Wall | MODIFIER | UNCOMMON | — | KEEP | — | Leak-block modifier; "wall" maps to blocked leaks |
| CHAIN_LIGHTNING | Chain Lightning | MODIFIER | UNCOMMON | — | KEEP | — | Bounce mechanic = lightning chain, exact |
| PRECISION | Precision | MODIFIER | COMMON | — | KEEP | — | Sniper damage modifier; sniper = precision, correct |
| DRAW_TWO | Draw Two | UTILITY | COMMON | — | RENAME | Quick Draw | Placeholder name; only card named after its mechanic verbatim |
| RECYCLE | Recycle | UTILITY | UNCOMMON | — | KEEP | — | Discard+redraw loop, name is exact metaphor |
| ENERGY_SURGE | Energy Surge | UTILITY | RARE | — | KEEP | — | Energy gain + "surge" timing signal, works |
| LAST_STAND | Last Stand | SPELL | RARE | exhaust | KEEP | — | STRONG keyword signal |
| OVERLOAD | Overload | MODIFIER | RARE | exhaust | KEEP | — | STRONG keyword signal |
| BATTLE_SURGE | Battle Surge | UTILITY | UNCOMMON | exhaust | RENAME | Emergency Orders | BAD type-signal (sounds like combat spell); exhaust not signaled |
| IRON_WILL | Iron Will | MODIFIER | UNCOMMON | exhaust | RENAME | Far Sight | BAD stat-signal (range, not will/endurance); BAD rarity signal (sounds permanent) |
| STOCKPILE | Stockpile | UTILITY | UNCOMMON | retain | KEEP | — | STRONG keyword signal (stockpile = hold in reserve) |
| WAR_FUND | War Fund | SPELL | COMMON | retain | KEEP | — | STRONG keyword signal (fund held in reserve) |
| VANGUARD | Vanguard | MODIFIER | UNCOMMON | retain | KEEP | — | WEAK keyword signal but acceptable; isolated after ADVANCE_GUARD rename |
| BULWARK | Bulwark | MODIFIER | COMMON | retain | KEEP | — | WEAK stat-signal (range not defense) but retain signal is adequate |
| OPENING_GAMBIT | Opening Gambit | UTILITY | UNCOMMON | innate | KEEP | — | STRONG keyword signal |
| SCOUT_ELITE | Scout Elite | SPELL | COMMON | innate | KEEP | — | WEAK keyword signal but "elite" implies always-available |
| ADVANCE_GUARD | Advance Guard | SPELL | COMMON | innate | RENAME | Forward Pay | BAD — collides with VANGUARD, no gold/innate signal |
| FIRST_BLOOD | First Blood | SPELL | UNCOMMON | innate | KEEP | — | STRONG keyword signal |
| DESPERATE_MEASURES | Desperate Measures | SPELL | UNCOMMON | ethereal | KEEP | — | STRONG keyword signal |
| WARP_STRIKE | Warp Strike | SPELL | RARE | ethereal | RENAME | Phase Bolt | WEAK — visual collision with LIGHTNING_STRIKE; "warp" underused |
| PHANTOM_GOLD | Phantom Gold | SPELL | COMMON | ethereal | KEEP | — | STRONG keyword signal |

---

## H3 keyword name-quality matrix

| CardId | Current name | Keyword | Quality | Notes |
|---|---|---|---|---|
| LAST_STAND | Last Stand | exhaust | STRONG | Last stand = final effort, one-time use |
| OVERLOAD | Overload | exhaust | STRONG | Overloading = pushing past limit, can't be reused |
| BATTLE_SURGE | Battle Surge | exhaust | BAD | Sounds like a repeatable combat spell; exhaust not implied |
| IRON_WILL | Iron Will | exhaust | BAD | Implies permanence and endurance — opposite of exhaust |
| STOCKPILE | Stockpile | retain | STRONG | Holding resources in reserve is the mechanic |
| WAR_FUND | War Fund | retain | STRONG | Funds held for the right moment |
| VANGUARD | Vanguard | retain | WEAK | Lead force suggests aggression, not patience/holding |
| BULWARK | Bulwark | retain | WEAK | Defensive fortification — retain reads as "fortifying your hand" loosely |
| OPENING_GAMBIT | Opening Gambit | innate | STRONG | Gambit = opening sacrifice; innate = always in opening hand |
| SCOUT_ELITE | Scout Elite | innate | WEAK | "Elite" implies reliability, but "innate" is not obvious from "elite" alone |
| ADVANCE_GUARD | Advance Guard | innate | BAD | No gold signal, no innate signal; collides with VANGUARD |
| FIRST_BLOOD | First Blood | innate | STRONG | First = before everything else; blood = first attack; maps to innate precisely |
| DESPERATE_MEASURES | Desperate Measures | ethereal | STRONG | Desperation = use it now or the moment passes |
| WARP_STRIKE | Warp Strike | ethereal | WEAK | "Warp" loosely signals transience but "strike" suggests a reusable attack |
| PHANTOM_GOLD | Phantom Gold | ethereal | STRONG | Phantom = appears and vanishes; exact ethereal metaphor |

---

## Genre register findings

The dominant tone across neutral cards is **military-industrial** with occasional **sci-fi accents**. "Rapid Fire," "War Fund," "Shield Wall," "Fortify," "Salvage," "Advance Guard," and "Vanguard" all read from the same military operations register. "Overclock," "Chain Lightning," "Cryo Pulse," and "Energy Surge" are the sci-fi cluster. These two registers coexist without friction — they represent different card families (battlefield command vs. technology) and players do not typically perceive them as conflicting.

The inconsistency is localized: the gold cluster mixes registers within the same mechanical category. "War Fund" and "Advance Guard" are military; "Gold Rush" is prospecting/Western; "Phantom Gold" is arcane. Four gold cards, four different genres. This is acceptable at the level of individual cards with distinct keywords, but would need addressing if a future "gold archetype" were to exist as a coherent visual group.

The worst register offender is the tower variant naming pattern. "Tesla Chain" imports a proper-noun brand (Nikola Tesla → Tesla coil) that sits in a different register from "Reinforced Basic" or "Cluster Splash." "Tesla" reads as corporate/sci-fi branding and breaks the pattern. The rename to "Chain Tesla" reduces but does not eliminate this — consider "Arc Chain" as an alternative if the Tesla brand feel is unwanted, but that is beyond this sprint's scope.

---

## S6 implementation list

Concrete rename pairs for Sprint 6. All changes are to `CardDefinition.name` strings only. CardId enum values are unchanged. No spec file string updates required beyond `card-definitions.spec.ts` if it asserts card names directly — verify with `grep -r "Quick Draw\|Heavy Fog\|Bounty Orders\|Forward Pay\|Far Sight\|Phase Bolt\|Emergency Orders" src/`.

| CardId | Old name | New name |
|---|---|---|
| TOWER_SPLASH_CLUSTER | Cluster Splash | Splash Cluster |
| TOWER_SLOW_AURA | Aura Slow | Slow Aura |
| TOWER_CHAIN_TESLA | Tesla Chain | Chain Tesla |
| TOWER_MORTAR_BARRAGE | Barrage Mortar | Mortar Barrage |
| ENEMY_SLOW | Enemy Slow | Heavy Fog |
| GOLD_INTEREST | Gold Interest | Bounty Orders |
| DRAW_TWO | Draw Two | Quick Draw |
| BATTLE_SURGE | Battle Surge | Emergency Orders |
| IRON_WILL | Iron Will | Far Sight |
| ADVANCE_GUARD | Advance Guard | Forward Pay |
| WARP_STRIKE | Warp Strike | Phase Bolt |

Total: **11 renames** (4 tower variant order normalization + 7 identity/signal fixes).

Files to update: `src/app/run/constants/card-definitions.ts` (name strings only). Check `card-definitions.spec.ts` for any `toBe('...')` assertions on card names.
