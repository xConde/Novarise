# Tower Lighting Cohesion — Phase H Audit

## Accent point-light configuration

`TOWER_ACCENT_LIGHT_CONFIG` in `lighting.constants.ts` is the single source of
truth for all tower accent point-lights:

- `intensity: 0.3`
- `distance: 1.2` world units
- `decay: 1.5` (between linear and inverse-square)

All 6 tower types call `attachAccentLight(group, towerType, isLowEnd)` in
`TowerMeshFactoryService`. No per-type overrides — the config is applied uniformly.
Each tower then repositions the light to its own apex Y via:

```
const light = towerGroup.userData['accentLight'];
if (light) { light.position.set(0, TOWER_ACCENT_Y, 0); }
```

Y positions per tower type:

| Tower  | Accent light Y                   | Constant                |
|--------|----------------------------------|-------------------------|
| BASIC  | `BASIC_ACCENT_Y` = 0.40          | `tower-anim.constants`  |
| SNIPER | `SNIPER_ACCENT_Y` = ~0.38        | `tower-anim.constants`  |
| SPLASH | `SPLASH_Y.accentLight` = ~0.73   | `tower-anim.constants`  |
| SLOW   | `SLOW_ACCENT_Y` = ~0.42          | `tower-anim.constants`  |
| CHAIN  | `CHAIN_Y.accentLight` = 0.90     | `tower-anim.constants`  |
| MORTAR | `MORTAR_ACCENT_Y` = ~0.54        | `tower-anim.constants`  |

## Low-end gate

The `isLowEnd` flag is passed as:
```ts
document.body.classList.contains('reduce-motion')
```

This is the same pattern used by `ScreenShakeService`. It reuses the motion-
accessibility class as a performance gate, which is semantically imprecise:
`reduce-motion` signals "suppress animations for accessibility" while the
intended check is "device is too weak for point lights".

**Deferred fix:** Inject `RuntimeModeService` and replace the `document.body`
check with `this.runtimeMode.isLowEnd`. Currently deferred because:
1. Point lights are correctly skipped for `reduce-motion` users (conservative,
   safe — those users appreciate the lighter scene).
2. `RuntimeModeService` does not currently expose a stable `isLowEnd: boolean`
   property; wiring it requires a separate sprint.
3. The feature is cosmetic; no correctness risk.

When `RuntimeModeService` gains a stable `isLowEnd` boolean, `TowerMeshFactoryService`
should be updated to inject it and replace the DOM check. The pattern will be:

```ts
constructor(
  @Optional() private readonly runtimeMode?: RuntimeModeService,
) {}

// In createTowerMesh:
const isLowEnd = this.runtimeMode?.isLowEnd ?? false;
this.attachAccentLight(towerGroup, towerType, isLowEnd);
```
