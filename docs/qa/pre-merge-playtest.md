# Pre-merge QA + playtest + UX audit — `feat/archetype-depth`

**Purpose:** structured walkthrough before merging `feat/archetype-depth`
into `main`. The branch is 69 commits ahead and has three full archetype
phases (Cartographer / Highground / Conduit) + library reframe + UI
overhaul + save/resume stack. This doc is the merge gate.

**Executor:** the user, or a Claude paired with the user running the
dev server (port 3999). Not a code-modification doc — read-only QA
until a bug is found, then ship a tight fix commit.

**Cross-refs:**
- `docs/balance/session-4-findings.md` — Part 0 code audit, balance
  deltas, no-op upgrade inventory. **Read first.**
- `memory/project_phase4_session5_kickoff.md` — session-5 pickup if
  work becomes code changes instead of QA.

---

## 1. Merge-gate checklist (must be true before merging)

Boolean gates. If any is false, do NOT merge.

| Gate | How to verify |
|---|---|
| Tests green | `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 \| tail -3` → `6664 SUCCESS` |
| Production build clean | `npx ng build --configuration=production 2>&1 \| tail -10` → no errors |
| Dev server boots without console errors | `npm run dev`; open each route `/`, `/edit`, `/run`, `/play`, `/profile`, `/library`, `/settings`; DevTools console shows 0 errors |
| Routing works | Back button from each route returns to `/`; `/library` visible when `environment.enableDevTools: true`, redirects otherwise |
| No player-visible dev copy leakage | `grep -rEi "DEV\|TODO\|FIXME\|placeholder\|XXX\|HACK" src/app --include="*.html" --include="*.ts" \| grep -v "spec\.ts"` → zero player-facing hits |
| No `(Upgraded — no change; slot reserved…)` strings in UI | `grep -r "slot reserved" src/app/run/constants/card-definitions.ts` → zero hits (fixed in session 4) |
| Save + resume round-trips | Start run → complete 1 combat → Save & Exit → reload page → Resume → verify board state matches |
| All 4 archetypes present in Codex | `/library`, filter by each archetype chip → `cartographer`, `highground`, `conduit` each show ≥ 5 cards; `siegeworks` correctly shows 0 (phase 5) |
| No uncaught exceptions mid-wave | Play to wave 5 on any run; DevTools console 0 errors |
| Reduce-motion + FPS toggles | Pause menu → toggle both, verify effect (animations stop / FPS counter shows) |

---

## 2. Playtest script — 6 runs to cover breadth

Each run: note start time, record required measurements (§3), flag any
bug / UX awkwardness inline. A run takes 20–40 min; full playtest is
~3 hours. Skip runs you've already done; this is a checklist, not a
script.

### Run A — Cartographer-heavy (reshape-the-board test)
**Goal:** does the terraform cadence feel good? Does CARTOGRAPHER_SEAL
deliver on its rare promise? Is `LAY_TILE` actually useful in practice
or does the player never build path tiles?
- Pick Cartographer-aligned rewards aggressively when offered
- Target deck: LAY_TILE × 2, BLOCK_PASSAGE × 2, BRIDGEHEAD × 1,
  COLLAPSE × 1, CARTOGRAPHER_SEAL × 1, LABYRINTH_MIND × 1
- **Watch for:** (a) LAY_TILE feels situational/dead weight?
  (b) BRIDGEHEAD 3-turn timer feels fair or punishing?
  (c) CARTOGRAPHER_SEAL rare actually changes play patterns?

### Run B — Highground-heavy (elevation mastery test)
**Goal:** does the elevation system reward investment? Is
`AVALANCHE_ORDER` situational, clutch, or dead? Does
`KING_OF_THE_HILL` snowball?
- Pick Highground-aligned rewards; build towers on elevated tiles
- Target deck: CLIFFSIDE × 1, HIGH_PERCH × 2, VANTAGE_POINT × 1,
  AVALANCHE_ORDER × 1, KING_OF_THE_HILL × 1, GRAVITY_WELL × 0 (skip;
  it's a known no-op upgrade rare, gauge without it)
- **Watch for:** (a) Elevation LOS feels intuitive?
  (b) TITAN / WYRM boss composition hits at the right difficulty?
  (c) DEPRESS_TILE + AVALANCHE combo readable?

### Run C — Conduit-heavy (adjacency clustering test)
**Goal:** does the graph system pay off visually and mechanically?
Is `CONDUIT_BRIDGE`'s new 5/7 duration (shipped this session) the
right value? Does HIVE_MIND feel rare-appropriate?
- Pick Conduit-aligned; force cluster buildup before wave 5
- Target deck: HANDSHAKE × 2, FORMATION × 1, LINKWORK × 1,
  HARMONIC × 1, GRID_SURGE × 1, CONDUIT_BRIDGE × 1, ARCHITECT × 0
  (skip — known no-op upgrade; avoid confusing yourself)
- **Watch for:** (a) Link-mesh visuals (lines between linked towers)
  readable without hand-squinting?
  (b) HANDSHAKE +15% feels impactful or marginal?
  (c) CONDUIT_BRIDGE 5-turn window — is it too long now? (shipped
  3/4 → 5/7 this session; watch for >90% uptime dominance)
  (d) TUNING_FORK relic — always-on +10% with cluster, feels like a
  run-defining pickup or a nice-to-have?

### Run D — Cross-archetype / neutral baseline
**Goal:** does the archetype reward weighting (60% aligned / 40%
neutral) snowball dominant archetype too hard? Can a generalist
deck still work?
- Pick whatever looks good; do NOT commit to one archetype
- **Watch for:** (a) Dominant archetype locks in by wave 5? 7? Never?
  (b) Neutral cards (starter / draw / scout) still feel relevant?
  (c) Any "locked out" feel — wanted a Conduit card but pool keeps
  offering Cartographer?

### Run E — Save + resume interrupt stress test
**Goal:** the save/resume stack is the least-playtested surface.
Break it if it can break.
- Start a new run
- Mid-wave (not at end-turn boundary — DURING enemy movement):
  click Save & Exit
- Close browser tab entirely
- Reopen browser → navigate to `/run` → click Resume
- Verify: turn number, energy, hand, pile counts, towers on board,
  enemy positions, status effects, wave progress all intact
- Repeat at: start of wave, middle of wave, after a CONDUIT_BRIDGE
  virtual edge is active, after a DEPRESS_TILE has exposed enemies
- **Watch for:** (a) any visual desync (tower placed but no mesh)?
  (b) virtual edges missing from link mesh after restore?
  (c) mortar zones retain turn-expiry correctly?

### Run F — Ascension ladder regression (ascension 5)
**Goal:** the Phase 3 + 4 additions haven't broken high-ascension
difficulty curve.
- Start a run at ascension 5 (if locked, bump `AscensionModifierService`
  default or simulate via profile)
- Play to wave 10 or defeat
- **Watch for:** (a) enemy HP scaling feels right (not trivial, not
  impossible)?
  (b) shop prices sting appropriately?
  (c) no crashes from the additional modifiers stacking?

---

## 3. Balance measurements to capture

For each run in §2, record the following in a shared note / spreadsheet.
These feed future balance tuning; without them session-5 balance work
is guesswork.

| Metric | How to capture | Notes |
|---|---|---|
| Gold-per-wave curve | Note total gold at wave 1, 3, 5, 7, boss | Should rise slightly faster than linear; check no "gold starvation" phase |
| Cards played per turn (avg) | End of run: total cards played / total turns | Target ~2.0; <1.5 feels stingy, >3.0 feels spammy |
| Dominant archetype lock-in turn | First turn at which the deck has ≥ 4 cards of one archetype | <5 = snowbally, >15 = no archetype identity |
| Tower count by wave 5 | Count towers on board | Target 6–10; <4 = placement pressure, >15 = spam |
| TUNING_FORK uptime % (if owned, Run C) | Turns where ≥ 1 tower has a neighbor / total combat turns | Expect ~90% in Conduit-heavy; lower elsewhere |
| CONDUIT_BRIDGE uptime % (Run C) | Turns with an active bridge / combat turns where bridge was possible to play | 60–80% is the target window after the 5/7 buff; >90% = still too strong |
| Boss TTK (turns to kill) | At wave 10 boss, count turns from boss-spawn to boss-death | Ascension 0: 3–5 turns feels right; ascension 5: 6–10 |
| Lives lost per wave (avg) | Run total / wave count | <0.5 = easy, >1.5 = frustrating |
| Run duration (wall time) | From start to victory/defeat | 25–40 min is the design target |

---

## 4. UI/UX audit — per surface

One pass per surface. Look-for lists, not bugs to fix. If something's
off, log it in a new `docs/qa/ui-ux-findings.md` (or reply in chat),
not here.

### Landing page (`/`)
- Idle animation readable, not distracting
- "New Run" / "Resume" button states correct (Resume only when a
  checkpoint exists)
- Settings cog visible + 44px mobile target
- Nav bar entries (Home / Editor / Library) all rendered when
  `enableDevTools: true`

### Run hub (`/run`)
- Node map legible; node types (combat / shop / event / rest / boss)
  visually distinct
- Resume indicator pulses correctly if a checkpoint exists for this
  run; disappears after abandon or victory
- Act 2 transition — boss defeat → advance → new map renders?
- Back-to-home navigation prompts?

### Combat HUD (`/play`)
- **Turn banner:** flashes on turn change (1.2s)
- **End Turn button:** disabled when pending placement; "stuck"
  cyan pulse when 0 energy + 0 playable cards
- **Card hand:** readable at 5/7/10 cards; hover tooltip appears
  after ~300ms hover
- **Energy pip:** fill pulse on energy change; numeric readout
  matches pip count
- **Pile inspector:** Space or click pile count → modal opens,
  cards grouped by pile; Esc closes + focus returns; focus trap
  works
- **Last turn summary:** bottom-center, 5-record rolling buffer,
  does not overlap cards or the End Turn button
- **Active relics:** pause menu lists all; HUD letter-chip peek
  shows subtle indicators
- **Spawn preview:** enemy-type labels visible, colors match
  EnemyStats per type
- **Challenge indicator:** demotable, not overwhelming
- **Link mesh (Conduit):** lines between linked towers visible
  but not distracting; virtual edges visibly distinct from
  spatial ones (if so designed)

### Codex (`/library`)
Already polished in session 4 but verify:
- Header centered (Back / Codex / seen tally)
- Sticky on scroll
- Silhouettes readable for unseen cards (cost + rarity hint + "?"
  visible, name/desc hidden)
- Tab counts update live when a card is seen
- Filter bar sticky below header, backdrop blur when stuck
- Search debounce feels right (~150ms)
- Preview upgrades toggle flips base/upgraded per tile
- Detail modal: single-panel when upgrade is identical to base;
  side-by-side when genuinely upgraded
- No "DEV", "QA", "Full color", "Reset seen" text anywhere
- Mobile 2-col grid at 375×667 — tiles readable

### Profile (`/profile`)
- Rank title + progress bar
- Stats tables accurate (cross-check vs a just-completed run)
- Tower arsenal bars proportional
- Achievements collapsible per-category, unlocked vs locked visually
  clear

### Pause menu (in-combat Esc)
- Resume / Save & Exit / Abandon — correct button states
- Gold-tinted Save & Exit
- Reduce-motion toggle stops animations
- FPS toggle shows counter
- Active relics listed
- Controls help `<details>` expandable

### Settings cog (top-right, all routes)
- 44×44px mobile target
- Vertical alignment matches HUD stats-row on mobile
- Opens settings modal (not settings route)

---

## 5. Known issues — do NOT re-flag

These are already documented; no need to report again.

### No-op upgrades (7 cards; from `session-4-findings.md` §"Known no-op upgrades")
`LAY_TILE`, `DEPRESS_TILE`, `DETOUR`, `CARTOGRAPHER_SEAL`,
`GRAVITY_WELL`, `ARCHITECT`, `HIVE_MIND`. Each ships with an
`upgradedEffect` identical to `effect`. The Codex detail modal +
tile now hide the "Upgraded" panel / badge in these cases (session 4),
so players don't see duplicate copy. Real upgrade values are
session-5 work.

### Pre-existing flaky spec
`src/app/run/integration/run-flow.spec.ts` — "should generate an event
and resolve a choice" fails intermittently (unseeded event-choice
RNG). Not a session-4 regression. Session 5 will investigate.

### Balance tensions flagged but not shipped
See `session-4-findings.md` §"Balance tensions — NOT shipped". The
shipped delta was `CONDUIT_BRIDGE 3/4 → 5/7`. Still awaiting playtest:
FORMATION range bump, HANDSHAKE damage bump, ARCHITECT cost reduction.

### CONDUIT_BRIDGE diagonal semantics
Manhattan=2 diagonal towers qualify as "non-adjacent" and can be
bridged. Technically correct; may surprise players. Copy is fine;
revisit if playtest flags it.

### Doc rot items already noted
- `game-board.component.ts:1303` references `§17 restore coordinator`
  in the spike that doesn't exist by that label
- `tower-combat.service.ts:508-512` — `assertNotFiring` is a soft warn;
  strict-mode throw deferred until a mid-fireTurn graph-mutating card
  exists

---

## 6. Post-merge cleanup queue (if merge ships)

Nice-to-haves that don't block merge but should land post-merge:

- **`ARCHITECTURE.md` update** — currently stale; missing
  EncounterCheckpointService, TowerGraphService, LinkMeshService,
  SeenCardsService, library/Codex surfaces, composeDamageStack stages.
- **Phase 5 Siegeworks kickoff** — 80-sprint plan's final archetype.
- **Phase 4 sprints 53-56** — DISRUPTOR / ISOLATOR / DIVIDER /
  QA gate. Content work; post-balance.
- **Close or revisit PR #29 (`feat/ascent-mode`)** — 83 commits ahead
  of main, likely superseded by the archetype-depth scope. Decide:
  merge-forward, close, or rebase.

---

## 7. Pre-merge sign-off

When all of §1 pass, all 6 runs in §2 done, §3 measurements captured,
§4 audit complete with findings logged elsewhere, and §5 known-issues
list is understood — the branch is mergeable.

Mergeability gate summary:
- [ ] §1 all green
- [ ] §2 runs A, B, C complete (archetype coverage)
- [ ] §2 runs D, E, F complete (cross-archetype / save-resume /
  ascension regression)
- [ ] §3 measurements captured for runs A, B, C (balance data)
- [ ] §4 surfaces audited (UI/UX one-pass)
- [ ] §5 known-issues list read + acknowledged
- [ ] No NEW critical bug surfaced in runs
- [ ] User decides to proceed (subjective sign-off)

Target execution time: ~3 hours for a thorough pass. Can be split
across sessions — the playtest runs are independent.
