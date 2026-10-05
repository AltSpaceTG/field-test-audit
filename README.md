# field-test-audit

A Claude Code skill that audits a project by "field-testing" it: parallel agents build and run
realistic mini applications against the built artifact, a skeptical verifier reproduces each
finding, and verified findings are fixed with regression tests before the next round.

## Install

```bash
git clone https://github.com/AltSpaceTG/field-test-audit ~/.claude/skills/field-test-audit
```

Invoke with `/field-test-audit` or ask Claude to "find vulnerabilities / weaknesses in this project".

## Layout

- `SKILL.md` — the full process
- `references/personas.md` — persona catalogs (library, web service/API, frontend, CLI, data pipeline), security checklist, ideas for new cases
- `references/workflow-template.js` — generic Workflow script for one round (fill the placeholders)
- `scripts/summarize_round.py` — summarises a round's workflow output
