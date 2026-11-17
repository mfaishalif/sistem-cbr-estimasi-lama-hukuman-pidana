# Domain Docs

## Layout and reading rules

This repo uses a single-context layout:
- `GLOSSARY.md` at the repo root defines domain vocabulary.
- `docs/adr/` holds architecture decision records.

Before exploring the codebase, read the glossary and ADRs relevant
to the area being investigated.

If these documents do not exist, proceed silently.
The `/domain-modeling` skill creates them when terms or decisions
are resolved.

## Vocabulary

Use glossary terms in issue titles, proposals, hypotheses, and tests.
When a needed concept is missing, reconsider the term or note the gap
for `/domain-modeling`.

## ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR explicitly
and explain why the decision should be reconsidered.
