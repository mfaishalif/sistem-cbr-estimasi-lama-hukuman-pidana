# Issue tracker: GitHub

Issues and specs live in GitHub Issues for
`mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana`.
Use the `gh` CLI from this repo.

## Conventions

Before creating the first issue of a session, verify the target with
`gh repo view --json nameWithOwner`. If it differs from the repo above,
resolve the target before writing.

- Create: `gh issue create --title "..." --body-file <path>`.
  Write multiline bodies to a UTF-8 file with actual newlines.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
  Add label and state filters as needed.
- Comment: `gh issue comment <number> --body-file <path>`.
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: post the explanation as a comment, then run
  `gh issue close <number>`. Post explanations separately even when
  an issue is already closed.
- Sub-issues: `gh issue edit <parent> --add-sub-issue <child>`.
  If unavailable, add the child to the parent's task list and put
  `Part of #<parent>` at the top of the child body.
- Dependencies: `gh issue edit <child> --add-blocked-by <blocker>`.
  If unavailable, put `Blocked by: #<number>` at the top of the child body.
  A ticket is unblocked when every blocker is closed.
- Count open blockers:
  `gh api repos/{owner}/{repo}/issues/<number> --jq .issue_dependencies_summary.blocked_by`.
  For text-based dependencies, check the referenced issues' states.

## Skill operations

"Publish to the issue tracker" means create a GitHub issue.
"Fetch the relevant ticket" means read the GitHub issue and its comments.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

For `/wayfinder`:
- The map is an issue labelled `wayfinder:map`, containing Notes,
  Decisions-so-far, and Fog.
- Tickets are map sub-issues labelled `wayfinder:<type>`, where type is
  `research`, `prototype`, `grilling`, or `task`.
- The frontier is the first open child in map order with no open
  blockers and no assignee.
- Claim with `gh issue edit <number> --add-assignee @me` as the session's
  first write.
- Resolve by commenting with the answer, closing the ticket, and adding
  a gist plus link to the map's Decisions-so-far.
