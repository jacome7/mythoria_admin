---
description: 'Run typecheck, lint, build and test. Fix any error or warning until clean.'
agent: 'agent'
---

Goal: make the workspace pass the Quality Gate with zero errors and (as much as feasible) zero warnings.

Process:

1. Run the VS Code task named "Quality Gate".
2. If it fails, identify the exact errors from the terminal output and Problems panel.
3. Fix issues with minimal, targeted code changes.
4. Re-run "Quality Gate".
5. Repeat until it passes.

Rules:

- Prefer the smallest safe change.
- Don’t refactor unrelated code.
- If multiple fixes are possible, choose the one that best matches existing patterns in the repo.
- When done, summarize what was fixed and where.
