---
name: preflight
description: Pre-PR quality gate. Runs tests, scans for magic numbers, checks Three.js disposal, and validates constants architecture.
disable-model-invocation: true
argument-hint: "[--fix to auto-fix issues]"
allowed-tools: Bash(npm test *), Read, Grep, Glob, Agent
---

# Preflight Check

Run a comprehensive quality gate before opening a PR. Report all issues found, grouped by category.

## Step 1: Run Tests
```bash
npm test -- --no-watch --browsers=ChromeHeadless 2>&1 | tail -20
```
If tests fail, stop and report failures. Do not proceed to other checks.

## Step 2: Magic Number Scan

Find files changed since the base branch:
```bash
git diff --name-only main...HEAD -- '*.ts' ':!*.spec.ts'
```

For each changed `.ts` file (excluding specs), scan for magic numbers:
- Numeric literals that aren't `0`, `1`, `-1`, or array indices
- Hex color literals (`0x...`) not in a `constants/` file or `model.ts` config object
- String literals used as storage keys not in a constants file

**Allowlist** (don't flag these):
- Values inside `TOWER_CONFIGS`, `ENEMY_STATS`, `WAVE_DEFINITIONS`, `TERRAIN_CONFIGS`, `UPGRADE_MULTIPLIERS`
- Values inside files under `constants/` directories
- GLSL shader code (between backtick template literals with `gl_Position` or `void main`)
- Angular decorator arguments (`@Component`, `@Injectable`, etc.)
- Import statements
- Test files (`*.spec.ts`)

Report each finding with file, line number, the value, and a suggested constant name.

## Step 3: Three.js Disposal Audit

For each component file that imports `three`:
1. Check that `ngOnDestroy()` exists
2. Check that it cancels `requestAnimationFrame`
3. Check that it calls `.dispose()` on geometries, materials, and passes
4. Check that event listeners are removed (look for `removeEventListener`)
5. Check that subscriptions are unsubscribed

Report any missing cleanup.

## Step 4: Constants Architecture Check

Verify:
- No board dimensions (`25`, `20`) appear as raw numbers outside `board.constants.ts`
- No tile size/height values appear as raw numbers outside constants files
- Spawner ranges are computed from board dimensions, not hardcoded

## Output Format

```
## Preflight Results

### Tests: PASS/FAIL (X/Y passing)

### Magic Numbers: X issues
- file.ts:42 — `0.08` → suggest `PROJECTILE_RADIUS`
- file.ts:88 — `400` → suggest `PARTICLE_COUNT`

### Disposal: X issues
- component.ts — missing geometry.dispose() for `skyboxGeometry`

### Constants: X issues
- service.ts:9 — raw board width `25` should use BOARD_WIDTH

### Summary: READY / X issues to fix
```

If `$ARGUMENTS` contains `--fix`, attempt to fix each issue automatically by extracting constants and adding disposal calls.
