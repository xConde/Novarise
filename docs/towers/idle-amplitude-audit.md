# Idle Animation Amplitude Audit — Phase I Sprint 58

Reviewed 2026-04-30 against tower-anim.constants.ts post-Phase-H.

## Per-Tower Amplitudes

| Tower  | Idle gesture             | Amplitude                          | Rationale                                                        |
|--------|--------------------------|------------------------------------|------------------------------------------------------------------|
| BASIC  | Turret swivel ±5°        | 5 × (π/180) ≈ 0.087 rad           | Subtle rifle sweep — gun should feel alive but not jittery.      |
| SNIPER | Scope lens emissive pulse| min 0.45 → max 0.95, period 1.4 s | Optical "lock-on" blink. No positional bob — sniper reads as still.|
| SPLASH | Drum idle rotation       | 0.4 rad/s constant                 | No positional bob; rotation is the gesture. Fire boosts to 4.5 rad/s.|
| SLOW   | Emitter breathe          | 0.7 → 1.0 emissive, 2 s period    | Cryo "life" in the dish. T3 crystal bob: ±0.04 u at 1.2 rad/s.  |
| CHAIN  | Sphere Y hover bob       | ±0.04 u, 1.6 s period             | Magnetic levitation read. Electrodes shimmer independently.       |
| MORTAR | Barrel elevate gesture   | +5° (0.087 rad) every ~4 s        | Loading gesture — barrel raises then settles. No continuous bob.  |

## Verdict

Amplitudes are intentionally non-uniform. CHAIN's hover (0.04 u) deliberately
differs from SLOW's crystal bob (0.04 u) because the visual gestures serve
different reads: CHAIN = levitation energy, SLOW = cryo pulse.

No normalization needed. Rationale is self-evident from silhouette role.

## Constants source

All values in `src/app/game/game-board/constants/tower-anim.constants.ts`.
