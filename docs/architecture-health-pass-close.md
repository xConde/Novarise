# Architecture / Engineering-Health Pass — close-out (2026-06-13)

Branch `feat/architecture-health-pass`. Driven by a 6-dimension engineering-health
audit (services & DI, large-file decomposition, test architecture, dead code,
coupling/boundaries, type safety). The audit's verdict: the codebase is in
genuinely good shape for an 8,200-spec single-author project — strict TS, coherent
state-management split, disposal-audited Three.js. The pass shipped the high-value,
low-risk improvements and the two lowest-risk service/test refactors, while
deliberately **leaving large-but-cohesive files alone**.

State at close: **8283 specs green** (was 8246 at branch start / 8240 on main),
lint clean (3 pre-existing warnings), build clean.

## Round 1 — 14 quick wins

Real bug fixed: `recordChallengeCompleted()` had no caller →
`challenger_5`/`challenger_all` were permanently unachievable; now wired.
Dead module-scope services removed from `GameModule.providers`;
`cardEffectService.tickWave/reset` moved from `GameRenderService` to the wave-
lifecycle owner `WaveCombatFacadeService`; 11 shadowed services + dangling imports
removed from the game-board spec TestBed; `assertNever` on the ascension switch;
achievement % fixed to exclude dead IDs; dead campaign-progress types removed;
seeded RNG in two specs; a cross-layer constant import dropped; barrel exports
added; `SerializedRunStateFlags` moved into its model; setup panel guarded with
`!isInRun`; ARCHITECTURE.md corrected (checkpoint v11, decomposition complete).

## Round 2 — low-risk type refactors

`CARD_VALUES` (~353 LOC) extracted from `card-definitions.ts` into its own file.
`SpellId` (14) + `UtilityId` (4) literal unions added to `CardEffect`, with
`assertNever` exhaustiveness on both dispatch switches — a new/misspelled id is now
a compile error, not a silent no-op. `MutationOp`/`MutationRejectionReason`/
`ElevationRejectionReason` lifted out of game **service** `.types.ts` files into
game **model** files so the run model no longer imports the game service layer
(the audit's highest-severity layer violation).

## Round 3 — service extraction + test factory

`RunShopService` extracted from the 1366-LOC `RunService` god-object (now 1223).
Owns shop-item generation, archetype-aware picks, weighted rarity, pool builders,
and cost calcs. **Deliberately non-circular** (the audit's own plan would have made
RunService↔RunShopService mutually injected): RunShopService takes `RunState` as a
parameter and injects only Relic/Deck/SeenCards; the state-mutating buy methods
stay in RunService. `createTowerCombatServiceTestProviders` /
`createCombatLoopServiceTestProviders` factories now give specs the production DI
graph; `CombatLoopService` had 3 `@Optional` deps promoted to required.

## Deferred (documented next steps, not done)

These are sound future work — left out by risk/value judgment, with an incremental
path already scoped in the audit:

- **TowerCombatService `@Optional`→required promotion.** ~9 deps, but ~14 separate
  TestBed configs in its spec each provide different subsets — blast radius too
  large to promote safely now. Migrate those nested describes onto the new factory
  first, then promote.
- **card-definitions.ts per-archetype split (WI3 phase 2).** The file is already
  section-commented by archetype with clean seams; `Record<CardId, CardDefinition>`
  makes a missing entry a compile error at the merge point. Do it as its own PR.
- **RunService event/reward seams.** `resolveEvent` mutates runState directly with
  interleaved flag-writes + RNG draws — the highest-risk seam. Extract
  `RunRewardService` (lower risk) before `RunEventService`, after the RunShopService
  delegation pattern proves out.

## Explicitly left alone (audit "leave it")

`tower-combat.service.ts`, `enemy.service.ts`, `CheckpointRestoreCoordinatorService`
(18-step ordered invariant), `run-events.ts` (pure data) — large but cohesive;
splitting would add hot-path indirection or hide an invariant. `noUncheckedIndexedAccess`
global flag, runtime schema validators, and abstract-protocol injection — not worth
the cost at current scale. Guard the two real index-access risks surgically instead.
