---
name: review-fix
description: Ingest PR review feedback, triage findings, fix real issues, and re-run quality gates. Re-entry point for the sprint workflow when a PR reviewer identifies problems.
disable-model-invocation: true
argument-hint: "[PR-number or blank for current branch PR]"
allowed-tools: Bash(git *), Bash(npm *), Bash(gh *), Read, Edit, Write, Grep, Glob, Agent
---

# Review Fix — PR Feedback Loop

A PR reviewer (human or Claude CI) has flagged issues. Your job: triage, fix, verify, and push — with the same discipline as the original sprint.

## Phase 1: Ingest Feedback

Pull the PR review comments:
```bash
# Get PR number for current branch (or use $ARGUMENTS)
gh pr view --json number,title,state,reviewDecision
gh pr view --json comments --jq '.comments[].body'
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | "**\(.path):\(.line // .original_line)** — \(.body)"'
```

If `$ARGUMENTS` is a PR number, use that. Otherwise, detect from the current branch.

Read ALL review comments. Categorize each one:

### Triage Categories

| Category | Action | Example |
|----------|--------|---------|
| **REAL BUG** | Must fix. Add to battle plan. | "This will NPE if enemies array is empty" |
| **MAGIC NUMBER** | Must fix. Extract to constants. | "Why is 0.08 hardcoded here?" |
| **DISPOSAL LEAK** | Must fix. Add cleanup. | "This geometry isn't disposed in ngOnDestroy" |
| **STYLE/NIT** | Fix if trivial (<2 min), skip if not. | "Prefer const over let here" |
| **FALSE POSITIVE** | Dismiss with reasoning. | "This is actually handled by the guard on line 42" |
| **SCOPE CREEP** | Do NOT fix. Note for future sprint. | "You should also refactor the wave system" |

## Phase 2: Update Battle Plan

Append to `STRATEGIC_AUDIT.md`:

```markdown
## Review Feedback — [Date]

### Source: [Human / Claude CI / PR #N]

### Triaged Findings
- [x] Finding 1: [title] — REAL BUG — will fix
- [x] Finding 2: [title] — MAGIC NUMBER — will fix
- [ ] Finding 3: [title] — STYLE/NIT — skipped (not worth the churn)
- [ ] Finding 4: [title] — FALSE POSITIVE — [explain why]
- [ ] Finding 5: [title] — SCOPE CREEP — deferred to Sprint [N]

### Fix Plan
- [ ] Fix 1: [specific action for finding 1]
- [ ] Fix 2: [specific action for finding 2]
```

**Rules for triage:**
- If in doubt whether something is a real issue, it's a real issue. Fix it.
- Never dismiss a magic number finding. If a reviewer spotted it, the constants-guide skill should have caught it — that's a process gap.
- Never dismiss a disposal finding. These are GPU memory leaks.
- Scope creep items go into `STRATEGIC_AUDIT.md` under the relevant future sprint — don't lose them.

## Phase 3: Fix Loop

For each item in the Fix Plan:

### 1. Fix It
Apply the same discipline as `/closer`:
- [ ] No magic numbers — use or create constants
- [ ] Three.js objects get disposal
- [ ] Coordinate systems match (editor column-major, game row-major)
- [ ] State mutations use confirm-before-spend pattern

### 2. Test It
Full test suite. Every time.
```bash
npm test -- --no-watch --browsers=ChromeHeadless 2>&1 | tail -10
```

### 3. Check It Off
Update the Fix Plan in `STRATEGIC_AUDIT.md`.

### 4. Commit It
Single commit for all review fixes (unless fixes are logically independent):
```bash
git add [specific files]
git commit -m "$(cat <<'EOF'
fix: address PR review feedback

- [finding 1 summary]
- [finding 2 summary]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

## Phase 4: Re-validate

After all fixes are committed, run the red-team scan again — but ONLY on the new changes:
```bash
git diff main..HEAD --stat
```

Check:
1. Did the fixes introduce NEW magic numbers?
2. Did the fixes add Three.js objects without disposal?
3. Are there any regressions in the full test suite?

If clean, push:
```bash
git push origin HEAD
```

If the red-team finds new issues in the fixes, loop back to Phase 3. Do NOT push broken fixes.

## Phase 5: Respond

If the PR has comment threads, resolve the ones you fixed:
```bash
# Leave a summary comment on the PR
gh pr comment $PR_NUMBER --body "$(cat <<'EOF'
## Review Fixes Applied

### Fixed
- Finding 1: [what you did]
- Finding 2: [what you did]

### Dismissed (with reasoning)
- Finding N: [why it's not an issue]

### Deferred
- Finding N: tracked in STRATEGIC_AUDIT.md Sprint [X]

All 579 tests passing. Pushed fixes.
EOF
)"
```

## When to Re-run the Full Workflow

If the PR reviewer found **3+ REAL BUG findings**, the original red-team pass was insufficient. After fixing, run `/red-team` fully (not just the fix delta) to catch anything else that slipped through. This is the feedback loop:

```
/sprint-kickoff → /closer → /red-team → push PR
                                            ↓
                                     PR review feedback
                                            ↓
                                     /review-fix (this skill)
                                            ↓
                              ┌─── <3 real bugs? → push fix
                              └─── ≥3 real bugs? → /red-team (full) → push fix
```
