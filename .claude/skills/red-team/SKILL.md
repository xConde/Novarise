---
name: red-team
description: Hostile code review of current branch changes. Scans for magic numbers, disposal leaks, config drift, and logic holes specific to Novarise.
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(npm test *), Read, Grep, Glob, Agent
---

# Red Team Quality Gate — Novarise

STOP. Switch roles. You are now a hostile reviewer whose job is to find holes in the code on this branch.

## Phase 0: Scope Lock

```bash
git diff --stat main..HEAD
```

Only review files changed on this branch. Do NOT suggest improvements to unchanged code.

## Phase 1: Automated Scans

Run all of these. Every one. No skipping.

### 1a. Magic Number Scan
For each changed `.ts` file (excluding specs):
```bash
git diff --name-only main..HEAD -- '*.ts' ':!*.spec.ts'
```

Read each file and flag:
- Numeric literals not in a `constants/` file or `*model.ts` config object (excluding 0, 1, -1, array indices)
- Hex color literals (`0x...`) not in an existing config (TOWER_CONFIGS, ENEMY_STATS, TERRAIN_CONFIGS)
- Hardcoded board dimensions (25, 20) outside `board.constants.ts`
- Duplicated values that appear in multiple files

### 1b. Three.js Disposal Audit
For each changed file that imports `three`:
- Does `ngOnDestroy()` exist?
- Does it cancel `requestAnimationFrame`?
- Does it dispose every geometry and material created?
- Are event listeners stored as named refs and removed?
- Are subscriptions unsubscribed?
- Are post-processing passes and render targets disposed?

### 1c. Coordinate System Check
If any changed file does grid↔world conversion:
- Editor uses `tiles[x][z]` (column-major)
- Game uses `board[row][col]` (row-major)
- World uses `{x, y, z}` where y=height
- Flag any conversion that doesn't match these conventions

### 1d. State Mutation Check
If any changed file modifies game state (gold, lives, score):
- Is the confirm-before-spend pattern used? (verify mutation succeeds BEFORE deducting resources)
- Is the confirm-before-refund pattern used? (use returned object as source of truth, not stale reference)

## Phase 2: Cognitive Review

For each changed file, interrogate:

1. **Happy Path Bias:** Does this only work with perfect inputs? What happens with null, undefined, empty arrays, boundary values, negative numbers?
2. **3 AM Test:** Is this implementation too clever? Could a junior dev follow the flow?
3. **Integration Fragility:** Does this conflict with existing service patterns? Two sources of truth?
4. **Silent Failures:** Code paths that swallow errors, return misleading defaults, or degrade without signal?
5. **Tab-Switch Exploit:** Any time-dependent logic missing the deltaTime cap at 100ms?

## Phase 3: Report

Update `STRATEGIC_AUDIT.md`. Append:

```markdown
## Red Team Critique — [Date]

### Automated Scan Results
- Magic numbers: X found
- Disposal issues: X found
- Coordinate mismatches: X found
- State mutation issues: X found

### Finding 1: [Title] (CRITICAL/HIGH/MEDIUM/LOW)
**Location:** `file.ts:line`
**Risk:** What breaks, and under what conditions.
**Fix:** Concrete remediation.

### Finding 2: ...

### Sibling Check
When fixing a pattern in one method, grep for the same pattern in sibling methods.
```

## Phase 4: Fix the Worst One

1. Pick the single most critical finding.
2. Fix it in this branch.
3. Write or update tests that would have caught it.
4. Run the FULL test suite (not partial): `npm test -- --no-watch --browsers=ChromeHeadless`
5. Show the diff: `git diff`

Do NOT commit — wait for user review.

## Red Team Failure Modes (Check Yourself)

If you found zero issues, you aren't looking hard enough. This repo has known patterns that drift:
- `disposeMaterial()` duplicated in 3 files — did the branch add a 4th?
- Board size 25×20 hardcoded in multiple places — did the branch add another?
- `selectedTowerInfo` is a shared mutable reference — did the branch rely on it being immutable?
- `levelStars()` throws on negative input — did the branch pass unclamped values?
