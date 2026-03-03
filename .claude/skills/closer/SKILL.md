---
name: closer
description: Autonomous execution loop. Works through the sprint battle plan, coding and testing each step until the checklist is complete, then runs the pre-merge gate.
disable-model-invocation: true
argument-hint: "[--continue to resume from last checkpoint]"
allowed-tools: Bash(git *), Bash(npm *), Read, Edit, Write, Grep, Glob, Agent
---

# Closer Protocol — Novarise

You are authorized to complete the current sprint autonomously. Execute the battle plan in `STRATEGIC_AUDIT.md`.

## Pre-flight

1. Read `STRATEGIC_AUDIT.md` — find the active sprint's **Battle Plan** checklist.
2. Confirm you're on the correct feature branch: `git branch --show-current`
3. Run the full test suite: `npm test -- --no-watch --browsers=ChromeHeadless 2>&1 | tail -5`
   - If tests fail, fix them before proceeding.

If `$ARGUMENTS` contains `--continue`, skip to the first unchecked item in the checklist.

## Execution Loop

For each unchecked item in the Battle Plan:

### 1. Code It
Write the implementation. Before writing ANY code, check:
- [ ] Am I introducing magic numbers? If yes, create or use a constants file first.
- [ ] Am I creating Three.js objects? If yes, add disposal in `ngOnDestroy()` before moving on.
- [ ] Am I adding a new tower/enemy type? Use `/new-tower` or `/new-enemy` skill for scaffolding.
- [ ] Does this touch coordinate conversion? Verify editor (column-major) vs game (row-major) alignment.

### 2. Test It
Run the FULL test suite after every change. Not partial. Not "affected tests only."
```bash
npm test -- --no-watch --browsers=ChromeHeadless 2>&1 | tail -10
```

Novarise has 579 tests that run in seconds. There's no reason to skip any.

If tests pass, summarize: `579/579 passing`
If tests fail, fix them before proceeding. If a fix takes more than 3 attempts, document the blocker in `STRATEGIC_AUDIT.md` and move to the next item.

### 3. Check It Off
Update `STRATEGIC_AUDIT.md` — change `- [ ]` to `- [x]` for the completed step.

### 4. Commit It
Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
```bash
git add [specific files]
git commit -m "$(cat <<'EOF'
feat: [description of what this step accomplished]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### 5. Next
Move to the next unchecked item immediately. Do not stop to ask for feedback unless you hit a critical blocker.

## Constraints

- Do NOT refactor code outside the sprint scope.
- Do NOT introduce magic numbers. Every literal gets a named constant.
- Do NOT skip Three.js disposal for new objects.
- Do NOT commit with `--no-verify` or skip hooks.
- If a step creates a new service or component, add tests in the same commit.
- Full test suite on every commit, not just the final one.

## When the Checklist is Complete

Run the pre-merge gate:

### 1. Convention Scan
```bash
# Console.log artifacts
git diff main..HEAD -- '*.ts' | grep '+.*console\.log' | head -10

# TODO/FIXME/HACK
git diff main..HEAD -- '*.ts' | grep -E '\+.*(TODO|FIXME|HACK|XXX)' | head -10

# Magic numbers in changed files (broad scan)
git diff --name-only main..HEAD -- '*.ts' ':!*.spec.ts' | head -20
```

Read each changed file and verify no magic numbers were introduced.

### 2. Disposal Verification
For each changed file that imports `three`:
- Verify `ngOnDestroy()` disposes all new geometries, materials, passes.

### 3. Final Test Pass
```bash
npm test -- --no-watch --browsers=ChromeHeadless 2>&1 | tail -20
```
Hard gate. Do not proceed if any test fails.

### 4. PR Creation
```bash
gh pr create --title "[semantic title]" --body "$(cat <<'EOF'
## Summary
[2-3 sentences on what changed and why]

## Changes
- [Grouped by feature area, not by file]

## Test Results
[X/Y tests passing, 0 failures]

## Constants Created/Modified
- [List any new constants files]

## Disposal Added
- [List any new Three.js cleanup]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 5. Signal
Print: **"SPRINT COMPLETE — PR READY FOR REVIEW"**
Push the branch: `git push origin HEAD`
Stop.
