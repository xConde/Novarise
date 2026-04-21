# PR: `feat/archetype-depth` → `main`

**Draft.** Generated at session-5 close. Review and trim before posting.

## Summary

Ships three full spatial-archetype systems (Cartographer / Highground / Conduit)
plus the codex/library surface, session-5 balance pass, and pre-merge polish.
The branch converts the "Ascent Mode" pivot scope into a coherent TD-roguelite
with deck identity as the long-horizon depth vector.

**85 commits ahead of `main`.**
**6735 passing / 1 skipped**, prod build clean.

## What ships

### Phase 2 — Cartographer archetype (sprints 8-24)
- `PathMutationService` — runtime tile CRUD, 4 mutation ops (build / block / destroy / bridgehead)
- 8 cards: LAY_TILE, BLOCK_PASSAGE, BRIDGEHEAD, COLLAPSE, DETOUR, CARTOGRAPHER_SEAL, LABYRINTH_MIND, SCOUT_AHEAD (retagged)
- 2 relics: SURVEYOR_COMPASS, WORLD_SPIRIT
- Shared terraform tile material pool (Three.js disposal audited)
- `PathfindingService.findLongestPath` for DETOUR

### Phase 3 — Highground archetype (sprints 25-40)
- `ElevationService` — per-tile elevation state, LOS integration, cliff-mesh VFX
- 8 cards: RAISE_PLATFORM, DEPRESS_TILE, HIGH_PERCH, VANTAGE_POINT, CLIFFSIDE, AVALANCHE_ORDER, KING_OF_THE_HILL, GRAVITY_WELL
- 2 relics: SURVEYOR_ROD, OROGENY
- 2 new enemies (TITAN elite, GLIDER), 1 boss (WYRM_ASCENDANT)
- Elevation-aware damage composition in `composeDamageStack()`
- Checkpoint v9

### Phase 4 — Conduit archetype (sprints 41-52)
- `TowerGraphService` — 4-dir adjacency graph, cluster membership, virtual edges, disruption
- `LinkMeshService` — Three.js mesh layer for live cluster visualization
- 8 cards: HANDSHAKE, FORMATION, LINKWORK, HARMONIC, GRID_SURGE, CONDUIT_BRIDGE, ARCHITECT, HIVE_MIND
- 2 relics: TUNING_FORK, CONSTELLATION
- Turn-scoped modifier countdown (`durationScope: 'turn'`) — first card system using it
- Checkpoint v10 (adds `towerGraph.virtualEdges` + `disruptedUntil`)

### Library / Codex (sprints L1-L5 + polish)
- `/library` route (dev-gated via `environment.enableDevTools`)
- `LibraryFiltersComponent`, `LibraryCardTileComponent`, `CardDetailModalComponent`
- `SeenCardsService` — tracks discovered cards, silhouette rendering for unseen
- Player-ready Codex: sticky header, sticky view-mode tabs, sticky filter bar, search, sort, multi-chip filters (type / rarity / archetype / keyword / energy range)
- Mobile responsive 2-col grid, reduced-motion support, ARIA + tablist semantics

### Session-5 balance pass
- All 7 no-op card upgrades shipped with identity-shifting behavior (not session-4's
  proposed placeholder values — see `docs/balance/session-4-findings.md`):
  - GRAVITY_WELL: +10% max-HP bleed per gated turn
  - DEPRESS_TILE: spread to 1 random adjacent tile
  - DETOUR: 8% max-HP × extra-steps burst damage
  - CARTOGRAPHER_SEAL: +1E refund on first terraform each turn
  - LAY_TILE: draws 1 card on success (cycle-card)
  - ARCHITECT: cost 3E → 2E
  - HIVE_MIND: shares strongest member's splash / chain / blast / DoT / status
- FORMATION range bump +1/+2 → +2/+3 (session-4 deferred)
- HANDSHAKE damage bump +15%/+25% → +20%/+30% (session-4 deferred)
- CONDUIT_BRIDGE walkback 5/7 → 4/5 (session-4's 3/4 → 5/7 overcorrected)

### Schema additions (all backwards-compatible)
- `CardDefinition.upgradedEnergyCost?: number` + `getEffectiveEnergyCost(card)` helper
- `ElevationTargetCardEffect.spreadToAdjacent?: boolean`
- `TerraformTargetCardEffect.drawOnSuccess?: number`
- `MODIFIER_STAT.TERRAFORM_REFUND_USED_THIS_TURN`
- `CardEffectService.tryConsumeTerraformRefund()` + `.getMaxModifierEntryValue()`
- Tier-sentinel modifier values (1 = base, 2 = upgraded) on 4 cards

### Supporting refactors
- `composeDamageStack()` extraction (Phase 4 prep)
- `fireShotAtTarget` extraction from `fireTurn`
- `tickTurn` ordering fix for turn-scoped modifiers
- `/run` DI regression fix (`GameModule.providers` vs component-scoped peers)
- Hierarchical-injector guardrail spec

### Pre-merge polish (session 5 close)
- Dark scrollbar theming on library + detail modal
- Header / settings-cog collision fixed
- Sticky tabs below sticky header (tabs were previously unreachable after scroll)
- Upgraded-cost pill now reflects `upgradedEnergyCost`
- Flaky `run-flow.spec.ts` stabilized (pinned non-gamble event)
- Tower-graph `tickTurn` defensive `===` → `<=`
- Stale doc references cleaned up

## Known issues — intentionally unshipped, playtest-gated

- **Archetype reward weighting** — current 60% aligned / 40% neutral / 0% other archetypes. Analysis flags snowball risk; 50/30/20 is the proposed alternative. Needs playtest measurement of dominant-archetype lock-in rate at wave 5.
- **Conduit multiplicative stacking ceiling** — late-run 4-cluster can stack to ~3.5× baseline AoE DPS. Only measurable via Run C with a full Conduit deck.
- **`ARCHITECTURE.md`** is stale — missing post-Phase-4 services. Scheduled for post-merge cleanup commit.

## Test plan (user-executable; required before merge)

- [ ] Run A — Cartographer-heavy: does terraform cadence feel good? Is CARTOGRAPHER_SEAL's refund rare-worthy?
- [ ] Run B — Highground-heavy: does elevation reward investment? Does KING_OF_THE_HILL snowball?
- [ ] Run C — Conduit-heavy: measure cluster stacking; boss TTK at end-wave
- [ ] Run D — Cross-archetype / neutral baseline: does archetype lock-in happen too fast?
- [ ] Run E — Save + resume interrupt stress test (new save-resume stack is least-playtested)
- [ ] Run F — Ascension 5 regression
- [ ] §3 balance measurements captured for A, B, C
- [ ] §4 UI/UX audit per surface
- [ ] No new critical bug surfaced

Structured QA plan: `docs/qa/pre-merge-playtest.md`.

## Post-merge cleanup queue

- Delete `docs/qa/pre-merge-playtest.md`, `docs/balance/session-4-findings.md`, `docs/qa/pr-description-draft.md` — branch-scoped artifacts
- Refresh `ARCHITECTURE.md`
- Phase 5 Siegeworks kickoff
- Phase 4 sprints 53-56 (DISRUPTOR / ISOLATOR / DIVIDER / QA gate)
- PR #29 (`feat/ascent-mode`) disposition — likely superseded by this scope

🤖 Generated with [Claude Code](https://claude.com/claude-code)
