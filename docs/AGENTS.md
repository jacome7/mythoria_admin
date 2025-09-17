# docs Directory - Agent Notes

## Scope
- Markdown documentation for architecture, features, deployment, and implementation notes.
- Audience includes Mythoria stakeholders, engineering teams, and on-call responders.

## Editing Guidelines
- Keep prose concise and task oriented; favor sections over long paragraphs.
- Use ASCII characters only unless updating an existing diagram that already includes extended glyphs.
- Titles follow sentence case (e.g., `Feature overview`); prefer `##` and `###` levels for nesting.
- Highlight commands or code samples with fenced code blocks and language hints when applicable.
- Cross-link files within `docs/` using relative paths; verify all links locally after edits.
- Update timestamps or version callouts when content materially changes.

## Verification
- Run `npm run lint` if you touch MDX/MD content consumed by Next.js to catch formatting issues.
- Ensure diagrams or tables render correctly in GitHub preview.
- Note any documentation-only changes in PR descriptions so reviewers can skip full test runs when appropriate.

_Last refreshed: September 20, 2025_
