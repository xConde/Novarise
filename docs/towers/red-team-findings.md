# Tower Visual Polish — Brand Red-Team (Sprint 69)

**Date:** 2026-04-30
**Reference:** `docs/towers/visual-targets.md` (Mindustry / Defense Grid / Iron Marines /
Anomaly Defenders / Bloons TD 6)

---

## Assessment framework

Each tower is judged against the five reference games' specific lifted qualities:
- **Mindustry:** silhouette clarity at-a-glance
- **Defense Grid:** material weight and base vs emitter mass contrast
- **Iron Marines:** animation snappiness and combat telegraph
- **Anomaly Defenders:** visual language predicts mechanical role
- **Bloons TD 6:** tier-up clarity — each tier adds a named, visible token

---

## Per-tower critique

### BASIC — workhorse rifleman

**Silhouette (Mindustry standard):** Passes. Hex pad + turret + barrel reads immediately
as "rifle on a platform". Clear from above at game camera distance.

**Material weight (Defense Grid standard):** Partially passes. The hex pad has adequate
footprint. The turret housing height relative to the barrel is plausible. However, the
barrel-to-base mass ratio is thinner than Defense Grid reference — the barrel segments feel
like a sci-fi gun rather than a fortified turret. The distinction is minor at game scale.

**Animation (Iron Marines standard):** Passes. Turret swivel ±5° is subtle, purposeful,
does not compete with firing. Barrel recoil 0.05u is felt in motion. The recoil duration
could be slightly shorter (~80ms vs the current MUZZLE_FLASH_CONFIG duration) for a crisper
snap.

**Role legibility (Anomaly Defenders standard):** Passes. "Generic turret" is the correct
archetype for a workhorse.

**Tier clarity (BTD6 standard):** Passes. T2 barrel cap and T3 pauldrons are both visible,
named design tokens. Pauldrons are the stronger visual — the barrel cap is subtle.

**Overall: production-quality. No critical gaps.**

---

### SNIPER — precision long-range

**Silhouette (Mindustry standard):** Strong pass. Tripod base is unique across all 6 types.
Long barrel extending forward is immediately legible as "precision weapon".

**Material weight (Defense Grid standard):** Fails partially. The tripod struts are thin
relative to the scope and barrel housing — the whole tower reads as lightweight. A sniper
platform should feel anchored. Heavier strut radii (or a ground pad at strut tips) would
give it defensive weight without changing the silhouette read.

**Animation (Iron Marines standard):** The scope lens emissive pulse is good but passive.
The tower is completely static otherwise (no positional idle) — intentional per the audit,
but it reads as "unpowered" when idle. A micro-rotation of the barrel toward the nearest
enemy (the `SNIPER_TRACK_CONFIG` field suggests this was planned) would dramatically improve
the "sniper is watching" read without compromising snappiness on fire.

**Role legibility (Anomaly Defenders standard):** Passes. Long barrel = precision long-range.
Tripod = stability. Message is clear.

**Tier clarity (BTD6 standard):** Passes. Scope swap T1→T2 is visible. T3 hover stabilizer
replaces bipod — the silhouette change is real but the hover stabilizer geometry is subtle
relative to Bloons TD 6's named upgrade tokens. A slightly more dramatic T3 indicator would
strengthen this.

**Overall: strong silhouette, weak idle presence and anchor weight.**

---

### SPLASH — AoE rocket cluster

**Silhouette (Mindustry standard):** Passes. Square chassis + drum housing + tube cluster
facing forward reads as "rotary rocket launcher". The tube circle ring is unique.

**Material weight (Defense Grid standard):** Strong pass. The square chassis with fins has
the widest footprint in the lineup — the correct heavy-armor read for an AoE threat.

**Animation (Iron Marines standard):** Drum idle rotation is the highlight — the tower
feels mechanically alive even without firing. Drum spin boost on fire + tube emit round-robin
is a convincing fire sequence. This is the most animation-rich tower in the lineup.

**Role legibility (Anomaly Defenders standard):** Strong pass. Multi-tube cluster = AoE.
Rotating drum = loaded rounds. The mechanical language is unambiguous.

**Tier clarity (BTD6 standard):** Strong pass. Each tier adds rocket tubes (4 → 6 → 8),
which is a cleanly additive visual count that communicates power clearly. T3 heat vent is
a bonus visible marker.

**Overall: best-in-class design. No gaps.**

---

### SLOW — cryo field emitter

**Silhouette (Mindustry standard):** Passes. Octahedron base + torus rings is unique. The
concave emitter dish at the apex is the strongest identifying feature from the default game
camera.

**Material weight (Defense Grid standard):** Passes for the role — support towers should
look lighter than combat towers. The transparent/semi-transparent body material reinforces
the "energy device" vs "weapon" read.

**Animation (Iron Marines standard):** Emitter breathing is subtle and effective. T3 crystal
bob adds life. Missing frost-mist particles (deferred — see `phaseE-frost-deferred.md`)
would significantly strengthen the cryo identity at idle.

**Role legibility (Anomaly Defenders standard):** Partially passes. The crystalline shape
reads as "cold/cryo" for players who know the reference. But the emitter dish concavity
and the torus rings do not obviously communicate "slows enemies" to a first-time player —
this requires reading the card. Anomaly Defenders would add a frost-effect particle to the
idle state to close this gap.

**Tier clarity (BTD6 standard):** Passes. Second coil ring at T2, floating crystal core at
T3 — each adds a clear visual token.

**Overall: distinctive silhouette, role legibility depends partly on color (deferred frost
particles would fix this).**

---

### CHAIN — Tesla coil spectacle tower

**Silhouette (Mindustry standard):** Strong pass. Three tapering torus rings + floating
sphere is the most distinctive silhouette in the lineup. Unambiguous at any camera angle.

**Material weight (Defense Grid standard):** Partially fails. The torus coil rings are
narrow — the tower looks almost fragile. A Tesla coil should feel like a scientific
instrument on a heavy base. Slightly thicker torus tube radii, or a broader base cylinder,
would help without disrupting the silhouette.

**Animation (Iron Marines standard):** Sphere Y-bob is effective for the levitation read.
Electrode shimmer phase-offset per electrode position adds visual complexity that reads as
"electric charge". The arc opacity animation reinforces the discharge moment. Strong.

**Role legibility (Anomaly Defenders standard):** Strong pass. Coil stack + arcing electrode
= electrical discharge weapon. Anomaly Defenders standard met without any ambiguity.

**Tier clarity (BTD6 standard):** Passes. T2/T3 each add an orbiting sphere — clean additive
logic. The orbiting spheres are the clearest tier tokens in the lineup (visually distinct,
not just scale).

**Overall: best silhouette in the lineup, slightly fragile weight. High spectacle.**

---

### MORTAR — heavy artillery

**Silhouette (Mindustry standard):** Passes. Wide chassis + angled barrel at 45° reads as
artillery. The angled barrel is the strongest distinguishing feature — no other tower has
a clearly elevated barrel.

**Material weight (Defense Grid standard):** Strong pass. MORTAR has the widest chassis
footprint and the heaviest emissive suppression (no glow rings, no emissive accent sphere
except the basic muzzle flash). This is the correct heavy-metal-artillery read — Defense
Grid would approve.

**Animation (Iron Marines standard):** The barrel elevation gesture (raises +5° every ~4s)
is the most realistic idle behavior in the lineup — it reads as "loading a round". The
exaggerated recoil (0.15u) is the strongest firing feedback of any tower.

**Role legibility (Anomaly Defenders standard):** Strong pass. Heavy chassis + angled barrel
+ strong recoil = ballistic. No magic glow. The visual language is entirely mechanical, not
magical.

**Tier clarity (BTD6 standard):** Passes. T2 reinforced barrel is a geometry swap (subtle
diameter change). T3 dual-barrel side-by-side is the clearest tier token. The T2 change is
harder to read at game distance — a more dramatic barrel swap would help.

**Overall: production-quality. Anchor tower of the lineup aesthetically.**

---

## Cohesion assessment

**What works:**
- All 6 towers share the same decal panel-line vocabulary (rivet rows, bolt details) —
  the "tech object" grammar from Mindustry is present.
- Material roughness/metalness varies correctly per role: SLOW is polished, MORTAR is dull,
  CHAIN is reflective. The per-surface tuning called out in the Defense Grid reference is
  implemented.
- Recoil distance hierarchy (MORTAR 3×, SNIPER 1.6×, BASIC 1×, CHAIN 0.6×) matches the
  Iron Marines principle of compression-appropriate per-role.

**What still reads "indie":**
1. **Emissive uniformity.** Every tower has the same emissive-intensity budget (~0.4–0.45)
   to stay under the bloom threshold. This means all accent lights pulse with the same
   visual energy level, which feels like a constraint, not a design. Production games vary
   emissive brightness per-situation (charge-up = bright, idle = dim, post-fire = dim).
   The current emissive management is correct (avoids bloom over-application) but the
   uniformity is a tell.
2. **Base widths.** SNIPER and CHAIN bases are narrower than their game-camera silhouettes
   justify. The tripod struts and coil rings give the correct *height* profile but the
   *footprint* is narrower than a production game would allow for towers that should feel
   structurally anchored.
3. **No ambient movement at board level.** Production TD games (Mindustry, Iron Marines)
   have very subtle board-level idle effects (dust, energy arcs, heat shimmer near hot
   towers). None of Novarise's towers currently add ambient geometry to the board tile.
   The frost-mist deferral (SLOW) is the most impactful missing item.

---

## Top-3 punch list (pre-merge optional)

These are ranked by player-visible impact per implementation cost:

### P1 (HIGH IMPACT): Frost-mist particles for SLOW tower (Sprint 32 deferred)

**Why:** SLOW's cryo identity currently depends partly on its cool-blue color. Without
frost particles, a color-blind player might read it as "another energy field" rather than
"cold = slow". The frost-mist also gives SLOW an ambient presence at board level that
none of the other towers match — it would be the most memorable idle effect in the lineup.

**Where:** `phaseE-frost-deferred.md` has the full implementation plan.
**Estimate:** ~100–150 lines across `ParticleService` + SLOW `idleTick`.

---

### P2 (MEDIUM IMPACT): SNIPER barrel tracking toward nearest target

**Why:** The `SNIPER_TRACK_CONFIG` constant already exists in `tower-anim.constants.ts`.
The idle animation for SNIPER is a passive emissive pulse — adding a slow barrel yaw toward
the nearest enemy would make the tower feel "aware" and telegraph the high-precision role
without requiring any tooltip reading.

**Where:** SNIPER `idleTick` in `tower-mesh-factory.service.ts`. Needs access to the enemy
position list — either passed through `GameRenderService.animate()` or computed by
`idleTick` from `userData['nearestEnemyAngle']` updated by a combat service hook.

**Note:** Do NOT confuse this with I-4 (the whole-group yaw). The ideal fix is to add a
`trackingGroup` sub-group for the barrel+scope, then rotate that. I-4 is the prerequisite.
**Estimate:** 30–50 lines; blocked by I-4 geometry refactor (~100 lines).

---

### P3 (LOW-MEDIUM IMPACT): MORTAR T2 barrel visual

**Why:** The T2 barrel swap is the weakest tier-up token in the lineup — the diameter
increase is too subtle to read at game distance. Adding a visible barrel jacket geometry
(a sleeve cylinder around the T2 barrel) would make the T2 → T3 dual-barrel swap feel
like genuine progression rather than a minor tweak.

**Where:** MORTAR case in `tower-mesh-factory.service.ts`, around line 1400.
**Estimate:** 15–20 lines (one cylinder, positioned along the T2 barrel, `minTier: 2`,
`maxTier: 2`).

---

## Verdict

The redesign meets the "Mindustry-tier silhouette clarity + Defense Grid-tier material
detail" target set in `visual-targets.md`. All 6 towers are uniquely identifiable by
silhouette. The animation vocabulary is consistent and purposeful. The remaining gaps are
all quality-of-life polish rather than fundamental design failures. The top-3 punch list
items are optional pre-merge work at the user's discretion.
