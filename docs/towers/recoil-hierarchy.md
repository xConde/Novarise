# Recoil Distance Hierarchy — Phase I Sprint 59

Reviewed 2026-04-30 against BASIC_RECOIL_CONFIG, SNIPER_RECOIL_CONFIG, MORTAR_RECOIL_CONFIG
in `src/app/game/game-board/constants/tower-anim.constants.ts`.

## Role hierarchy (mortar > sniper > basic > chain ≈ splash ≈ slow)

| Tower  | Recoil distance | Relative to BASIC | Rationale                                                    |
|--------|-----------------|-------------------|--------------------------------------------------------------|
| MORTAR | 0.15 u          | 3×                | Heavy artillery — exaggerated kick sells the brute-force read.|
| SNIPER | 0.08 u          | 1.6×              | Sharp snap-back; high-power single shot.                      |
| BASIC  | 0.05 u          | 1×                | Baseline — adequate feedback for a workhorse rifleman.        |
| CHAIN  | 0.03 u (added)  | 0.6×              | Small spark-kick on discharge; reinforces electric feel.      |
| SPLASH | none            | —                 | Fire anim is drum spin + tube emit pulse, not physical recoil.|
| SLOW   | none            | —                 | Fire anim is emitter scale-pulse (cryo wave, not ballistic).  |

## CHAIN recoil

CHAIN's `fireTick` already registers `recoilStart`/`recoilDuration` with the
default BASIC distance as fallback. Sprint 64 sets `recoilDistance: 0.03` in
the fireTick so the chain tower gets its own small kick on discharge.
`CHAIN_RECOIL_CONFIG.distance = 0.03` defined in tower-anim.constants.ts.

## Constants source

`BASIC_RECOIL_CONFIG.distance = 0.05`
`SNIPER_RECOIL_CONFIG.distance = 0.08`
`MORTAR_RECOIL_CONFIG.distance = 0.15`
`CHAIN_RECOIL_CONFIG.distance = 0.03` (added Phase I)
