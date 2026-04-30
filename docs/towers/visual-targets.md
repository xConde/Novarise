# Tower Visual Targets — Production Reference

Five sci-fi tower-defense games whose visual language informs this redesign.
Each entry names the specific quality to lift, not the aesthetic wholesale.

---

## Mindustry (Anuken, 2019)

**Lift: silhouette clarity and panel-line vocabulary.**

Every Mindustry turret is readable as a unique silhouette from the aerial view — a
player never needs the name label to know what's placed. The key mechanism: each tower
has one dominant geometric gesture (the long barrel of the Hail, the dome of the Meltdown,
the paired cylinders of the Duo) that is legible at small on-screen size. Panel seam lines
and rivet rows are drawn in a consistent scale and spacing across all units, making the
game's "tech object" grammar recognisable without each tower looking identical.

Takeaway: every Novarise tower needs one defining silhouette feature visible from above.
Panel lines should come from a shared vocabulary (the decal library), not per-tower
invented patterns.

---

## Defense Grid: The Awakening (Hidden Path, 2008)

**Lift: material weight and scale contrast.**

Defense Grid towers have real physical presence — bases are visually heavy (broad, low,
bevelled), while emitters or barrels are comparatively narrow and elevated. The mass
contrast signals mechanical role: wide base = stability/durability, thin top = reach/threat.
Materials read as metal: visible specular highlight gradients, slight environment reflection
on polished surfaces, dark grout between panelled sections.

Takeaway: Novarise tower bases should be wider and heavier relative to their emitter tops.
Metalness + roughness on `MeshStandardMaterial` should be tuned per-surface (base is duller,
barrel/emitter has higher metalness), not uniform across the whole tower.

---

## Iron Marines (Ironhide, 2017)

**Lift: animation feel — snappy, purposeful.**

Iron Marines towers telegraph combat state through animation: a brief charge shimmer before
firing, a punchy recoil on the shot, and a rapid settle-back that feels satisfying without
being slow. The key insight is compression: animations play faster than the eye expects
(~80–120 ms for recoil), which makes them read as "snappy" rather than "floaty". Idle
animations breathe slowly (2–4 s period) so they don't compete with combat feedback.

Takeaway: firing animations should complete in ≤ 120 ms (2–3 frames at 60 fps). Idle
animations should use 2–4 s periods. Phase the two so they don't constructively interfere.

---

## Anomaly Defenders (11 bit studios, 2014)

**Lift: sci-fi readability — towers communicate their effect class visually.**

Each tower class in Anomaly Defenders has an unambiguous visual effect language: cryo
towers are angular and icy-blue, plasma towers have warm glowing vents, EMP towers have
exposed coil structures. The visual language predicts the mechanical behaviour before the
player reads a tooltip.

Takeaway: Novarise SLOW should read crystalline/cryo (angular geometry, cool-blue
emissive), CHAIN should read electrical (exposed coil, floating orb with arcing electrodes),
MORTAR should read ballistic (heavy metal, wide barrel, no emissive glows — fire is
mechanical not magical).

---

## Bloons TD 6 (Ninja Kiwi, 2018)

**Lift: tier-up clarity — each upgrade tier adds a visible, named design element.**

BTD6's upgrade paths add discrete visual tokens per tier: a scope, a bandolier, a pauldron.
The player can look at a tower and enumerate its upgrades visually. This clarity makes the
upgrade decision feel consequential.

Takeaway: Novarise T2 and T3 should each add one unambiguous visual element (not just a
scale-up). Phase B–G sprint plans already name these elements per tower type. When
implementing, ensure the T2/T3 element is visible and distinct from scale alone.
