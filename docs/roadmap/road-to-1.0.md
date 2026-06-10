# Road to 1.0 — locked 2026-06-10

Novarise is feature-rich but arc-incomplete. This doc defines what "finished
game" means and sequences the remaining work. Phase 1 ships on
`feat/road-to-v1`; later phases are one branch each, following the same
plan-doc → sprints → red-team → close-doc convention as prior efforts.

## Definition of done (1.0)

A new player can: launch to a title screen with music, learn the card loop
from the tutorial, play a 3-act run ending in a real final boss and a real
ending, lose and feel like retrying (ascension + unlocks), and never see
dead UI, placeholder copy, or pre-pivot leftovers.

## Verified state at lock time (main @ 546641a)

- 8050 specs green. 74 cards / 21 relics / 13 enemies / 6 towers /
  3 archetypes / 20 ascension levels / 16 boards.
- Lane B (PR #37) closed the legibility gaps: projectiles, enemy intent,
  forward sim, fire-zone previews, damage popups.
- Old audit CRITICALs re-verified 2026-06-10: 9 of 12 already fixed.
  Still open: minimap dead after restart; library tile renders `{kw-*}`
  literally.
- Run is 2 acts; boss nodes use 3 themed presets/act but every finale is
  the same generic `EnemyType.BOSS` stat-stick. Victory = generic summary.
- Zero music (SFX synthesis layer exists, master gain ready).
- Tutorial copy predates the card pivot ("press 1", "Start Wave").
- Endless mode unreachable from run flow (dead in pivot).

## Phase 1 — Complete the Arc (THIS BRANCH)

1. **Act 3.** `actsCount` 3, act-3 map tiers (late/endgame boards), act-3
   enemy pool + count scaling (new constant; act 1/2 balance untouched),
   `ACT3_BOSS_PRESETS` (3 presets × 8 waves).
2. **Final boss.** New `EnemyType.NOVA_SOVEREIGN`: heavy shield +
   per-turn shield regen, slow resistance, enrage (+1 tile/turn) below
   50% HP — telegraphed via intent UI and emissive shift. New mesh.
   Saved 2-act runs keep their config (no migration; they finish at act 2).
3. **Ending.** Victory epilogue sequence before run summary.
4. **Music.** Procedural WebAudio `MusicService` — hub/combat/boss themes,
   crossfade, gesture-gated start; settings gain music toggle + volume.
5. **Tutorial content pass** for the card-driven loop.
6. **Open fixes.** Minimap re-init on restart; library `{kw-*}` tokens
   through DescriptionTextComponent.

## Phase 2 — Presentation (next branch)

Title-screen treatment for landing (animated backdrop, music fade-in),
boss-intro banner polish, victory/defeat VFX dwell, per-tower card icons,
consistent empty/loading states. WebGL-unavailable fallback screen.

## Phase 3 — Events & economy depth

Corrected 2026-06-10 after code verification: consumables (8 ItemTypes,
ItemService, shop slot, HUD peek, combat callbacks), event chains
(3 flag-gated chains), and shop card-remove/upgrade slots ALL already
shipped — the original audit items were stale. Remaining substance:
event pool 19 → 40+ (more chains, item-reward events, card-economy
events), archetype-flavored event eligibility (does not exist), softer
event repeat behavior (uniform pool today — same event can repeat
back-to-back). Relic re-tiering still deferred pending playtest data.

## Phase 4 — Siegeworks (archetype 4)

The deferred 16-sprint phase from the archetype plan. Prereq: zone
lifecycle abstraction. Do not start before Phases 1–3; it is the largest
single effort and benefits from the balance data of 1–3.

## Phase 5 — Accessibility, mobile, hardening

Colorblind-safe palette audit + mode, font scaling, touch placement
preview (two-step pick flow), gamepad stretch goal, tech-debt paydown
flagged 2026-05-10 (tower-combat.service 1320 lines / 18 @Optional deps,
GameRenderService 14 deps, shop-screen state explosion). Also:
game-board.component.spec module-level spy providers are shadowed by the
component's own `providers:` array (found 2026-06-10) — several spies
(`gameSessionSpy`, formerly `minimapSpy`) are dead weight passing
coincidentally; migrate assertions to component-injector instances.

## Phase 6 — Balance & ship QA

Full-run playtest matrix across ascensions, starter-deck rework
(40% TOWER_BASIC concentration), endless-mode decision (wire as
post-victory mode or delete), achievement audit (campaign-era IDs vs run
mode), close-out doc + browser smoke checklist.

## Explicitly out of scope for 1.0

Steam packaging/Electron wrapper, cloud saves, localization, leaderboards.
Revisit post-1.0.
