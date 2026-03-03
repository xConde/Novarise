---
name: sprint-kickoff
description: Start a new sprint. Audits the repo, identifies the highest-value work, and produces a battle plan for user approval before any code is written.
disable-model-invocation: true
argument-hint: "[sprint-topic or blank for auto-detect]"
allowed-tools: Bash(git *), Bash(npm test *), Read, Grep, Glob, Agent
---

# Sprint Kickoff

You are the Lead Engineer for Novarise. Audit the repo and produce a battle plan — but do NOT write code until the user approves the plan.

## Phase 1: Deep Audit (Read-Only)

Run these in parallel:

1. **Velocity check:** `git log --stat -n 15 --oneline` — what's the recent trajectory?
2. **Branch state:** `git branch -a` + `git stash list` — any abandoned work?
3. **Test health:** `npm test -- --no-watch --browsers=ChromeHeadless 2>&1 | tail -10` — STOP if tests are red. Fix first, then restart this skill.
4. **Zombie scan:** Check for files/services that exist but aren't imported or routed anywhere.
5. **STRATEGIC_AUDIT.md:** Read it if it exists — what sprints are defined? What's already done?
6. **Constants debt:** Quick grep for raw numbers in recently changed files: `git diff --name-only HEAD~5 -- '*.ts' ':!*.spec.ts' | head -10` then spot-check for magic numbers.

If `$ARGUMENTS` is provided, focus the audit on that topic. Otherwise, identify the highest-value next sprint from `STRATEGIC_AUDIT.md`.

## Phase 2: Battle Plan

Update `STRATEGIC_AUDIT.md` (create if missing). Append:

```markdown
## Sprint: [Topic] — [Date]

### Scope
What exactly will this sprint deliver? Be specific — not "improve audio" but "add Web Audio service with 3 SFX: tower fire, enemy death, wave start."

### Pre-conditions
- [ ] Tests green (X/Y passing)
- [ ] No blocking bugs from prior sprints
- [ ] Constants architecture exists for touched subsystems (or will be created in step 1)

### Battle Plan
- [ ] Step 1: [specific action]
- [ ] Step 2: [specific action]
- [ ] Step 3: [specific action]

### Constants Impact
Which constants files will be created or modified? List them.

### Disposal Impact
Will any new Three.js objects be created? If yes, where will disposal happen?

### Risk
What could go wrong? What's the rollback plan?
```

## Phase 3: Branch (But Don't Code)

1. Define the branch name: `feat/velocity-[topic]`
2. Show the user the full battle plan.
3. **STOP.** Wait for user approval before creating the branch or writing code.

The user may:
- Approve → create branch, start coding via `/closer`
- Modify → adjust the plan, then approve
- Reject → pick a different sprint topic

## Why No Immediate Coding

This repo has 200+ magic numbers and tightly coupled Three.js rendering. Writing code before reviewing the plan risks:
- Introducing magic numbers that need extraction later
- Missing disposal requirements for new Three.js objects
- Building on assumptions about scope the user didn't intend

The 5-minute cost of a plan review prevents hours of rework.
