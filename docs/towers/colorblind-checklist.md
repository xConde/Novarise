# Tower Visual Polish — Color-Blind Simulation Checklist (Sprint 68)

**Post-merge verification — requires browser DevTools**

Open `/play` with towers placed. In Chrome DevTools → Rendering (three-dot menu →
More Tools → Rendering), enable each vision emulation mode listed below.
Tick each item as you verify it.

---

## Setup

1. Open Chrome DevTools (F12)
2. Click the three-dot menu → More Tools → Rendering
3. Scroll to "Emulate vision deficiencies"
4. Apply each mode listed below in sequence

---

## Deuteranopia (red-green, ~6% of males)

- [ ] BASIC (warm brown) — identifiable by hex pad + barrel silhouette, NOT just color
- [ ] SNIPER (purple) — identifiable by tripod struts + long barrel, NOT just color
- [ ] SPLASH (green) — identifiable by square chassis + rotating drum, NOT just color
- [ ] SLOW (blue) — identifiable by torus coil rings + concave dish, NOT just color
- [ ] CHAIN (gold) — identifiable by tapering coil stack + floating sphere, NOT just color
- [ ] MORTAR (brown) — identifiable by wide chassis + angled-up barrel, NOT just color
- [ ] Range rings still visible against dark board background (may look different in hue)
- [ ] Glow rings from tier-up flash still readable

---

## Protanopia (red-weak, ~2% of males)

- [ ] BASIC silhouette readable (hex pad + barrel distinguishes from MORTAR wide chassis)
- [ ] SNIPER silhouette readable (tripod is unique — no other tower has radial struts)
- [ ] SPLASH silhouette readable (drum protrusion + tube cluster)
- [ ] SLOW silhouette readable (torus rings + concave apex)
- [ ] CHAIN silhouette readable (tapering coil rings is unique)
- [ ] MORTAR silhouette readable (angled barrel elevation is unique)
- [ ] At least 4 of 6 towers unambiguously readable by silhouette alone (acceptable bar)

---

## Tritanopia (blue-yellow, ~0.01% of population)

- [ ] SLOW tower (blue emissive) — emitter dish still visible as a structural feature
- [ ] CHAIN tower (gold emissive) — arc material on arc cylinder still visible (opacity)
- [ ] All other towers — silhouette readability unchanged (tritanopia mostly shifts blues)
- [ ] Range rings still present (may lose blue-end tinting but geometry is visible)

---

## Achromatopsia (grayscale simulation — Blurred Vision mode approximates)

Use "Blurred Vision" or screenshot + desaturate in an image editor if Chrome does not
offer full achromatopsia emulation.

- [ ] All 6 silhouettes still individually recognizable in grayscale (the core success
      criterion of the silhouette redesign — Phases B–G were built around this)
- [ ] BASIC vs MORTAR: barrel axis direction distinguishes (BASIC horizontal, MORTAR elevated)
- [ ] SNIPER vs others: tripod leg splayed silhouette is unique in grayscale
- [ ] SLOW vs CHAIN: SLOW has concave apex (dish), CHAIN has convex sphere apex — readable

---

## Notes

The silhouette redesign in Phases B–G was motivated by color-blind accessibility:
each tower now has a unique geometric silhouette that does not rely on hue for
identification. The color-blind simulation should confirm this. If any tower fails
the silhouette test, the fix is a geometry change (not a color change) — increase
the distinctive geometric feature size.

Color-independent identifiers per tower at a glance:

| Tower  | Top-down identifier              | Side-view identifier         |
|--------|----------------------------------|------------------------------|
| BASIC  | Hex footprint + barrel axis      | Turret housing above flat pad |
| SNIPER | Three radial strut legs          | Low tripod + long horizontal barrel |
| SPLASH | Square + circular drum protrusion | Drum above wide chassis       |
| SLOW   | Octahedron footprint + torus ring | Torus rings + concave dish    |
| CHAIN  | Three stacked tori tapering up   | Tapering coil + sphere apex   |
| MORTAR | Wide rectangle + angled tip      | Chassis wide + barrel elevated 45° |
