---
description: 'Update dependencies to latest versions and fix breaking changes, then run quality gates.'
agent: 'agent'
---

Goal: update all dependencies to their latest versions, resolve breaking changes, and finish with a clean Quality Gate.

Scope:

- Package selection: ${input:packages:Optional list of packages to prioritize (leave empty for all)}
- Update strategy: ${input:strategy:Preferred approach (npm outdated + npm install @latest, or targeted upgrades)}

Process:

1. Review the current dependency state (package.json, package-lock.json, and npm outdated).
2. Update dependencies to the latest versions (prefer safe, targeted updates; avoid unrelated refactors).
3. For any breaking changes, review release notes, then update code, config, and tests to match new APIs.
4. Check for the latest Node.js Docker base images and update Dockerfile images and build configuration accordingly.
5. Run the VS Code task named "Quality Gate".
6. Fix any failures and re-run until clean.

Rules:

- Use PowerShell for any commands.
- Keep changes minimal and aligned with existing patterns in the repo.
- If updating Node images, ensure compatibility with existing build flags and CI expectations.
- If there are multiple migration paths, call out the tradeoffs and pick the least risky one.
- Summarize what changed and where, plus any follow-up recommendations.
