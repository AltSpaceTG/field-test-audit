---
name: field-test-audit
description: Find vulnerabilities, bugs, doc lies and rough edges in a project by "field-testing" it the way real users would - parallel agents each build and run a realistic mini application (or client, or attack scenario) against the built project, a skeptical verifier reproduces every finding, then verified findings are fixed with discriminating regression tests, reviewed, rebuilt, and the next round re-checks them and hunts new cases. Use this whenever the user asks to audit a project, hunt for vulnerabilities or weaknesses, stress/field-test a library, service or CLI, "найди уязвимости", "найди недоработки", "проверь проект как пользователь", "полевые испытания", "погоняй мини-приложения", "прогони раунд", or wants a repeatable bug-hunting loop over their codebase - even if they do not name this skill.
---

# Field-test audit

A loop that finds what code review misses: behaviour under real use. Each round, several agents
play different users of the project, write and *run* small realistic programs against it, and
report only what they can prove. A second agent tries to reproduce each report and is told to
disbelieve it. What survives gets fixed with a test that fails without the fix, and the next round
checks the fixes and goes looking somewhere new.

It works because the testers see the project from the outside (docs + built artifact), the
verifier filters noise, and every round's regressions keep the fixes honest. On the project it
was distilled from it ran 33 rounds: ~100-150 scenarios per round, the pass rate rose from the
low 90s% to ~97%, and almost every round still turned up one real high-severity bug until the
end — so expect value for many rounds on non-trivial code.

Talk to the user in their language (the reports in that project were in Russian).

## Before round 1: agree on scope (ask once, briefly)

Ask only what you cannot find out yourself:
- **Budget.** One round = ~12-15 agents, roughly 1.5-2M subagent tokens and 45-90 min wall clock.
  Ask how many rounds, or "until it converges".
- **Write permissions.** Fix found bugs, or report only? Commit or leave the working tree dirty?
  Default: fix, don't commit.
- **Compatibility.** May fixes change persisted formats / public API? (Answer changes what fixes
  are allowed.)
- **Out of scope** areas, environments the testers may use (Docker? network? cloud?).

Then do reconnaissance yourself (or with one Explore agent): read CLAUDE.md / README / docs index,
the build and test commands, the public API surface, what is persisted, what is
security-sensitive (auth, deserialization, multi-tenancy, crypto, file paths, SQL, shell), and
how a user consumes the project (a library from a package repository, a running service, a CLI,
a web UI). Record this in a short "project card" you reuse in every prompt.

## The round

### 1. Make the artifact the testers use
Build and install/publish the project the way users get it — `publishToMavenLocal`,
`npm pack`/`npm link`, `pip install -e` into a separate venv, a Docker image, a locally running
server. Testers must use **that**, never import from the source tree: the gap between "works in
the repo" and "works when installed" is itself a source of findings (missing exports, module
descriptors, packaging, default config).

### 2. Pick 5-7 personas (apps)
Each persona is a realistic user with a mini application and a scenario list. Cover different
*angles*, not different features — see `references/personas.md` for catalogs per project type
(library, web service/API, web frontend, CLI, data pipeline) and the security checklist that
the security-minded personas must work through.

Every app prompt has three parts:
- **Scenarios**: the core usage of that angle (stable across rounds, keeps coverage).
- **Regression checks**: last round's verified findings, now fixed — "verify R1...". Tell the
  tester exactly what changed (a "Changes since round N" list in the common prompt) so they can
  check claims against docs.
- **NEW cases**: one or two genuinely new, adversarial ideas per app per round. This is what
  keeps finding bugs after the obvious ones are gone: races, restarts mid-operation, crash
  consistency, upgrades and rollbacks, resource exhaustion, huge inputs, hostile inputs,
  misconfiguration, concurrency with admin operations, operator workflows (backup/restore,
  disaster drills), integration with real neighbours (DB poolers, replicas, proxies).

### 3. Run it as a Workflow
Invoking this skill is the user's opt-in for the Workflow tool. Load the `workflow-authoring`
skill if you have not in this session, then copy `references/workflow-template.js`, fill the
placeholders, and run it. The template runs apps in two waves (to limit concurrent builds), one
tester agent per app with a findings schema, then — only if it reported findings — one skeptical
verifier per app with a verdict schema. Keep a copy of every round script outside the session
scratchpad (it can be wiped between sessions), e.g. next to the project's memory directory.

Rules the common prompt must carry (they each fixed a real failure):
- Source and docs are **read-only**; each tester works only in its own directory.
- Start from the docs, read source only to diagnose. Doc snippets that do not compile or do not
  match behaviour are findings.
- Assert outcomes in code, repeat race-prone scenarios, report only with exact output as
  evidence plus repro steps — no speculative findings.
- Small heaps / limited parallelism, unique Docker container names and ports per round, clean up
  processes and containers.
- Builds by concurrent agents can clash (Gradle `EOFException`, `NoSuchFileException`,
  `NoClassDefFoundError`; npm cache locks): wait and retry, never kill processes you did not
  start.

The verifier classifies each finding as LIBRARY_BUG / DOC_BUG / API_FRICTION / USAGE_ERROR /
NOT_REPRODUCED with severity, a minimal repro and a `file:line` root cause, and defaults to
USAGE_ERROR or NOT_REPRODUCED without evidence. That default is what keeps the fix queue clean.

### 4. Triage
Summarize with `scripts/summarize_round.py <workflow-output.json>` (logs, failed scenarios,
every finding with its verdict). Then decide per verified finding:
- **Bug in code** → fix (step 5).
- **Doc bug** → fix the docs (all language versions the project keeps).
- **API friction** → small ergonomic fix if cheap and safe, else document it.
- **Design question** (the "right" behaviour is a product decision — e.g. what to do on
  OutOfMemoryError, whether to roll back a failed upgrade, retention defaults) → **ask the user**
  in plain words with the trade-off, do not guess. Restate their answer back before acting if it
  is terse: a one-line answer can mean the opposite of what it seems (on the source project
  "no, the application crashes" meant "it must not crash", and a guessed implementation had to be
  reverted).

### 5. Fix, prove, review
For each code fix:
1. Reproduce first (the verifier's minimal repro is usually a ready test).
2. Fix the root cause, matching the surrounding code style.
3. Add a regression test and **prove it discriminates**: back up the fixed file, revert just the
   fix (a scripted replace), run the test and see it fail, restore. A test that passes without
   the fix tests nothing — on the source project roughly one in five first-draft tests did.
4. Hand the diff to an independent reviewer agent (read-only, told to report only verified
   problems with file:line and scenario). It found bugs in the fixes themselves almost every
   round — races introduced by the fix, a guard covering 2 of 4 call sites, a lock held too long.
   Fix those too, then re-run the tests.
5. Split work by files: fix core code yourself, delegate independent modules and docs to
   parallel agents with explicit "do not touch X" lists so they never edit the same file.

### 6. Close the round
Full build + full test suite green (report the count), re-install/publish the artifact, append the
round to a backlog file in the repo or memory (findings, verdicts, what was fixed where, what was
deliberately not fixed and why, open design questions). Then report to the user: a table of
rounds (passed/total, regressions passed, HIGH findings, test count), what was fixed, and any
questions that need their decision.

### 7. Next round or stop
Generate the next script from the previous one: bump the round number, container names/ports and
app directory, rewrite "Changes since round N", replace each app's Regression and NEW blocks.
Check it parses before launching (for a JS workflow:
`node -e "new Function('return (async()=>{'+src+'})')"` after stripping `export`). Avoid
backticks inside the prompt strings.

Suggest stopping (or switching to a cheaper regression-only round) when two consecutive rounds
find no HIGH/MEDIUM code bugs and findings are mostly docs and friction; tell the user the trend
instead of looping forever. Always stop when the user says so — finish the current round's fixes,
build, and report, but launch nothing new.

## What not to do
- Do not let testers or verifiers modify the project; only you and your fix agents do.
- Do not commit, push or publish to public registries unless the user asked.
- Do not "fix" behaviour that is a product decision without asking.
- Do not count unverified findings or report them as bugs.
- Do not trust a green test that you have not seen fail without the fix.
