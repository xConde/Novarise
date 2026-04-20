# Session 4 — Balance + wording findings

Generated 2026-04-18 during the library polish + balance QA session on
`feat/archetype-depth`. Captures things worth shipping (with reasoning)
and things that should NOT ship without playtest verification.

## Part 0 — full-branch audit (sonnet-delegated review of the 66 commits on feat/archetype-depth)

### Bugs found
- **MEDIUM — `tower-combat.service.ts:508-512`** `assertNotFiring` is a soft
  warn, never a throw. A future card that mutates graph state mid-fireTurn
  will silently corrupt the neighbor map. Add strict-mode throw once any
  such card exists.
- **MEDIUM — integration spec version literals** flagged by audit. On
  follow-up: the literals are **intentional** (tests exercise migration
  paths). Renamed to `CHECKPOINT_VERSION_FIXTURE` + comment (shipped in
  this session's `chore` commit).
- **LOW — `link-mesh.service.ts:92-94`** edge restore depends on
  `attachScene` running before the checkpoint-restore path. No spec pins
  this ordering; fragile if route resolvers ever pre-load checkpoints.
- **LOW — ARCHITECT / HIVE_MIND** base and upgraded descriptions are
  identical. Session 4 hid the duplicate Codex panel; the underlying
  upgrade is still a no-op.
- **LOW — `tower-graph.service.ts:362-373`** `tickTurn` expiry uses `===`
  instead of `<=`. Defensive fix; deferred until a "skip N turns" card
  actually exists.
- **LOW — CONDUIT_BRIDGE semantics** "non-adjacent" includes diagonals
  (Manhattan = 2). Technically correct but could surprise players. Copy
  is fine; flag for playtest.

### Scope notes
- `tower-graph.service.ts` `getClusterTowers` re-allocates every call.
  Profile before caching — HIVE_MIND + ARCHITECT might push it past
  threshold.
- `encounter-checkpoint.service.ts isValidCheckpoint` does shallow
  shape-check only. Low real risk given the migration chain guarantees
  interior shape.
- Inconsistent optional-service pattern: some uses `?.` chaining, others
  `!== undefined` guards. Style-only.
- `SeenCardsService` accumulates in production regardless of
  `/library` visibility. If the dev gate is lifted, existing runs have
  already populated the Codex. Probably desired; worth a comment.

### Doc rot
- `docs/design/conduit-adjacency-graph.md` — heavy `linkSlots` / 
  `DEFAULT_LINK_SLOTS` references that no longer match code.
  **Shipped in this session** — added a SUPERSEDED banner.
- `tower-combat.service.ts:17-18` — "ProjectileService scheduled for
  file deletion" comment after the file was deleted. **Shipped in this
  session** — dropped.
- `tower-graph.service.ts:104` JSDoc says subjects `.complete()` in
  `reset()` but they don't. Harmless (subjects are reused), but
  misleading — comment is wrong.
- `game-board.component.ts:1303` references a §17 "restore coordinator"
  section in the spike that doesn't exist as labeled.

### Green-lights (reviewed, looks right)
- composeDamageStack TITAN/WYRM elevation hoist + `getEffectiveNeighborCount`
  helper path — session-3 workstream B extract did NOT regress.
- TowerGraphService circular-DI avoidance via the getter pattern.
- LinkMeshService Three.js disposal (shared materials disposed once).
- Checkpoint v9→v10 migration adds `towerGraph.virtualEdges` +
  `disruptedUntil` correctly; spec round-trip covered.
- TowerGraphService.reset() wired via GameSessionService with
  `@Optional()` guard.
- SeenCardsService hook points (5 paths — DeckService x3, RunService x2).
- CONDUIT_BRIDGE `expiresOnTurn = currentTurn + duration + 1` fencepost.

### Pre-existing flakiness
- `run-flow.spec.ts` — "should generate an event and resolve a choice"
  failed once (gold 230 vs expected 150), passed on re-run. Unseeded
  event-choice RNG somewhere. Flag for future investigation; not a
  session-4 regression.

---

## What shipped this session

**Library reframe (dev inspector → player Codex).**
- Scroll fix — app shell clips `overflow`, library now self-scrolls.
- Profile-style sticky header (3-col grid, centered title, "Codex" label).
- Dropped `DEV` badge, `Full color` toggle, `Reset seen` button, "read-only QA view" subtitle.
- Undiscovered cards render as silhouettes (cost + rarity visible,
  name/description hidden) instead of the previous flat desaturation.
- `position: sticky` filter bar; `user-select: none` on library surfaces.
- Tabs renamed All / Discovered / Undiscovered (StS-compendium style).

**Session-3 devil's-advocate fixes.**
- HIGH-1 color-mix @supports fallback on tile SCSS.
- HIGH-2 debounce timer cleaned up on `LibraryFiltersComponent` destroy.
- HIGH-3 `role="tablist"` now wraps only tabs (view-options split out).

**Wording cleanup in card-definitions.ts.**
- Stripped player-visible dev-ese `(Upgraded — no change; slot reserved for future balance tuning.)` from LAY_TILE and DEPRESS_TILE.
- Rewrote ARCHITECT: "neighbor-gated cards" → natural English.
- Tightened GRID_SURGE ("4 adjacent towers" → "all 4 neighbors filled").
- Tightened CONDUIT_BRIDGE ("random distant towers as adjacent" → "non-adjacent towers as neighbors").

**Detail modal / tile.**
- Upgrade panel now hidden when base/upgraded copy is identical (prevents
  the duplicate-panel anti-pattern on no-op upgrades).
- Tile hides the upgrade `+` badge + glow when `upgradedDescription` is
  absent or identical to the base.

**Balance — CONDUIT_BRIDGE 3/4 → 5/7 turns (shipped).**
See separate commit. Reasoning: 3-turn virtual edge was a blip inside a
7-10 turn wave. 5/7 gives meaningful uptime.

**Branch audit cleanups (shipped).**
See separate commit: SUPERSEDED banner on the conduit-adjacency-graph
spike, dead comment removal, renamed test-fixture version literals
(and pushed back on the audit's misread that the literals were stale).

## No-op upgrades — SHIPPED in session 5 (Option X)

Session 5 took the Option X path (ship real upgrades before merge, don't
merge unfinished content). All 7 no-op upgrades now have real values,
each landed as a single per-system commit with updated spec arithmetic.

| Card | Rarity | Shipped upgrade | Commit |
|---|---|---|---|
| GRAVITY_WELL | Rare | +10% max-HP bleed per turn on gated enemies | balance(highground): ship GRAVITY_WELL upgrade |
| DEPRESS_TILE | Common | Also depresses 1 random adjacent tile (same amount + expose) | balance(highground): ship DEPRESS_TILE upgrade |
| DETOUR | Uncommon | 8% max-HP damage per extra path-step walked | balance(cartographer): ship DETOUR upgrade |
| CARTOGRAPHER_SEAL | Rare | +1E refund on first terraform played each turn | balance(cartographer): ship CARTOGRAPHER_SEAL upgrade |
| LAY_TILE | Common | Also draws 1 card (cycle-card) | balance(cartographer): ship LAY_TILE upgrade |
| ARCHITECT | Rare | Cost 3E → 2E (enables same-turn combo plays) | balance(conduit): ship ARCHITECT upgrade |
| HIVE_MIND | Rare | Shares strongest member's secondary stats (splash / chain / blast / DoT / status) | balance(conduit): ship HIVE_MIND upgrade |

Designs diverge from the original findings-doc suggestions in three places
where the original proposals were rejected:

- **LAY_TILE** — `energyCost: 0` was rejected as an infinite-engine risk
  with CARTOGRAPHER_SEAL (free permanent path → LABYRINTH_MIND runaway).
  Cycle-card upgrade keeps 1E cost, sustains deck pressure.
- **HIVE_MIND** — "shares fire rate" was rejected as collapsing LINKWORK
  into HIVE_MIND. Secondary-stat sharing (splash/chain/DoT/status) is
  identity-shifting without stepping on LINKWORK's fire-rate role.
- **ARCHITECT** — kept as cost reduction despite the initial "laziest
  upgrade" critique. Alternatives (cluster modifier propagation, neighbor-
  count override) all collapsed other cards' identity. 3E → 2E is a
  genuine deck-building affordance: unlocks same-turn combos with
  HANDSHAKE / GRID_SURGE that the base cost effectively blocks.

Supporting schema changes (all backwards-compatible):
- `ElevationTargetCardEffect.spreadToAdjacent` (DEPRESS_TILE)
- `TerraformTargetCardEffect.drawOnSuccess` (LAY_TILE)
- `CardDefinition.upgradedEnergyCost` + `getEffectiveEnergyCost(card)` helper (ARCHITECT)
- `MODIFIER_STAT.TERRAFORM_REFUND_USED_THIS_TURN` (CARTOGRAPHER_SEAL per-turn gate)
- `CardEffectService.getMaxModifierEntryValue()` (anti-spoofing for tier sentinels)
- Tier-sentinel values on GRAVITY_WELL / CARTOGRAPHER_SEAL / DETOUR / HIVE_MIND effect values (1 = base, 2 = upgraded)

## Balance tensions — NOT shipped, need playtest

Per the session-4 kickoff rule "do not rebalance based on solo runs",
none of the following ship here. Each is a proposed delta with reasoning
for the user's playtest + decision.

### 1. CONDUIT_BRIDGE duration — SHIPPED THIS SESSION (3/4 → 5/7)

See commit. Monitor during playtest: if >90% of combat turns have an
active bridge, dial back to 4/6.

### 2. TUNING_FORK multiplier (1.10) — plausibly fine; kickoff flagged over-tuned

Kickoff argues +10% damage to every tower with ≥1 neighbor ≈ +8%
run-wide, which is strong for an uncommon. Counter-argument: uncommons
are 2× rarer than commons, and BASIC_TRAINING (+35% basic-only common)
delivers ~15–25% effective run-wide in a basic-heavy deck.

Recommendation: leave at 1.10. Revisit only if playtest shows TUNING_FORK
is the auto-pick uncommon relic regardless of deck composition.

### 3. FORMATION additive range — likely under-tuned

+1 / +2 tiles on the straight-line trigger is restrictive. Most boards
have ≥ 2 bends; a 3-in-a-row is rare in typical play, and the range
boost only applies for the wave.

Option A — keep effect, relax trigger: accept diagonals (adds
complexity to TowerGraphService).
Option B — same trigger, better payoff: +2 / +3 range. Simpler.

Proposal: Option B. Measure hit rate of the 3+ row trigger in
playtest; if <1 wave in 3 triggers it, B is a no-brainer buff.

### 4. HANDSHAKE bonuses (+15% / +25%) vs graph-query complexity

For an uncommon-archetype-locked card, +15% wave-scoped is modest.
DAMAGE_BOOST delivers +25% wave-scoped without any neighbor gate.
HANDSHAKE costs the same 1E but has the adjacency requirement.

Proposal: bump base to +20%, upgraded to +30%. Keeps the adjacency
tax meaningful but rewards the Conduit identity.

### 5. GRID_SURGE ×2 / ×2.5 — plausibly correct

4-neighbor gating is a hard ceiling. The few turns where you hit it,
the board-design tension ("should I sacrifice coverage for a cluster?")
is exactly the archetype identity. Leave as-is.

### 6. HIVE_MIND — powerful but gated by rarity

BASIC + SNIPER cluster → BASIC fires at SNIPER damage. Very strong.
But it's a rare-rarity encounter-scoped effect. 3E cost + rare weight
(10) + archetype-lock (40% of pool) should contain it.

Leave at current values until playtest shows runs trivialized.

### 7. Archetype reward weighting (60% aligned / 40% neutral)

`pickArchetypeAwareCard` snowballs a dominant deck faster than
Hearthstone draft weighting. Measure: how often does dominant
archetype lock in by wave 5? If >70% of runs, drop to 50/50.

Leave alone until playtest.

## Design inspirations (reference, not spec)

- **Slay the Spire 2** — card compendium pattern (silhouette → reveal
  on first encounter). Codex reframe mirrors this. Archetype locking
  in rare reward pools is a StS-native pattern worth protecting.
- **OSRS** — spell names ("Weaken", "Bind") are terse, never flavored
  over-much. Avoid prefacing Codex cards with "of the..." or similar.
  A subtle nod: "Vantage Point" / "Cliffside" already read OSRS-clean.
- **Gemcraft** — adjacency mattering, spell-tier synergy. Conduit
  archetype's cluster-gating is a direct descendant of Gemcraft's
  "towers amplify neighbors" identity. Keep it.

## Next session

- If balance changes ship in session 5: one delta per commit, per
  the kickoff rule. Expected spec churn is in `tower-combat.service.spec.ts`
  composeDamageStack arithmetic — budget accordingly.
- Sprint 53-56 (DISRUPTOR / ISOLATOR / DIVIDER / QA gate) still
  deferred. Do them AFTER a balance playtest, not before.
- Phase 5 (Siegeworks) remains the next 80-sprint phase.
