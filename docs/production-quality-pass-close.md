# Production-Quality Pass — close-out (2026-06-13)

Branch `feat/production-quality-pass`. Driven by an 11-dimension evidence-based
game audit (combat correctness, card system, economy, difficulty, enemies/towers,
run flow, UX/onboarding, Three.js/perf, a11y, dead content, polish). ~63 findings
triaged; the high-confidence, evidence-backed ones shipped across two rounds.

State at close: **8240 specs green**, lint clean (10 pre-existing warnings),
production build clean. Baseline was 8102 green.

## Round A — correctness, content, balance, UX, a11y, perf (~50 fixes)

Bugs: SHIELD_WALL charge-wipe (`duration` 0→null), MORTAR placement-turn
double-tick, FLYING gravity-well immunity, SWARM gravity-well mesh leak,
NOVA_SOVEREIGN shield scaling + mortar/regen ordering + boss screen-shake,
silent SLOW tower SFX, lucky-coin seeded RNG, life-loss SFX stacking, boss
death-burst count, OS-level reduce-motion, RAISE_PLATFORM no-op upgrade.

Content/dead-code: GLIDER/VEINSEEKER/MINER now spawn in run mode; FLYING
pre-boss exposure; elite/boss HP base multipliers wired (active at A0);
node-map last-row REST/SHOP suppression; distinct act-3-late maps; dead
endless/campaign achievements removed; dead Siegeworks Codex filter removed.

Balance (directional — see playtest note): starter deck 40%→25% BASIC;
ENERGY_SURGE base cost 1; SWIFT leakDamage 2; skip-gold 15/30; act-boundary
density offset (ACT_ROW_OFFSET 2, smooths the act-opener trough); rest-heal
floor (REST_HEAL_MIN).

Copy/UX: tutorial UPGRADE_TOWER→END_TURN, gold-cost onboarding, earlier tips;
LINKWORK/QUICK_DRAW/FROST_WAVE/Frostbite description corrections; run-summary
friendly node names; README rewritten for the roguelite loop.

a11y/perf: focus-trap on pile-inspector + card-detail; pulse-critical &
node-map reduce-motion fallbacks; larger HUD peek hit-areas; FLYING color
de-collision; per-frame scratch reuse (fire-zone / board-pointer / aim-line /
projectile / combat-vfx); enemy-intent sprite disposal; dynamic boss-theme
music switch; audio gain + damage-popup jitter polish.

## Round B — gold unification + encounter UI

**Gold is now one unified pool** (design decision: "unify run gold"). Combat
draws from carried run gold instead of a fresh ~200g; towers drain it; the
ending balance carries back. See ARCHITECTURE.md "Gold economy". Run-flow
fixes: event card-removal persists; shop pity; field_wager is a real lives
gamble; rest-heal floor wired. Encounter UI: RECAP now records cardsPlayed
(beginTurn window opens at turn start); tower canPlay gates on gold + badge
tint; tooltip gold cost; colorblind enemy-dot palette/shape cues; end-turn
reduce-motion.

## ⚠️ NEEDS PLAYTEST — balance baseline changed

The P1 economy/difficulty bug fixes + gold unification + directional tuning all
shifted the difficulty baseline. The suite proves correctness, not feel. The
two biggest feel changes to validate:

1. **Gold unification** — combat now draws from real run gold. A broke run can
   now be starved of build capital; overspending drains the run. This is the
   intended single-pool economy but should be played across a few full runs.
2. **Difficulty** — elite/boss HP multipliers now bite at A0; act openers are
   denser; SWIFT leaks 2. Combined with the gold change, early acts may feel
   tighter. Validate the A0–A5 ramp.

## Browser-smoke checklist

- [ ] Start a run; confirm /play HUD gold matches the run gold you entered with
      (not a flat 200).
- [ ] Place towers until gold runs low; confirm unaffordable tower cards show
      the red gold badge and cannot be played.
- [ ] Win an encounter; confirm run gold on the node map = your combat ending
      balance + reward (carries across, not reset).
- [ ] Play 2-3 cards in a turn; confirm the RECAP panel shows a non-empty row
      (cards-played count) instead of "—".
- [ ] Resume a saved encounter; confirm gold + RECAP survive restore.
- [ ] Reach a boss; confirm the boss music theme switches and reverts after.
- [ ] Toggle reduce-motion + colorblind in settings; confirm HUD pulses stop and
      wave/spawn enemy dots get distinct shapes/safe colors.
- [ ] Trigger the Field Wager event; confirm it costs lives upfront and can lose.

## Deferred (not in this branch)

- Shop pity reuses the combat `cardPityCounter` (one shared non-rare clock); a
  dedicated `shopCardPityCounter` needs a RunState field.
- Dead SFX_CONFIGS (waveComplete/gameOver) left in place — covered by shape
  specs in audio.service.spec; low-value cleanup.
- BETA tower specializations remain pure numeric trades (design-scope content).
- RANK_THRESHOLDS top out above the trimmed achievement count (profile polish).
- Tech-debt paydown (large files, @Optional deps, shadowed-provider spec) →
  Phase 2 architecture pass.
