// Field-test round template. Copy, then replace every __PLACEHOLDER__ and the APPS array.
// Keep prompt strings free of backticks other than the template literals themselves.
// Parse-check before running:
//   node -e "const s=require('fs').readFileSync('r1.js','utf8').replace(/^export const meta/m,'const meta'); new Function('return (async()=>{'+s+'})')"
export const meta = {
  name: '__PROJECT__-field-test-r__N__',
  description: 'Round __N__: mini apps against the latest __PROJECT__ build — regression checks and new edge cases, each app verified',
  phases: [
    { title: 'Build apps', detail: 'standalone apps using the installed artifact, two waves' },
    { title: 'Verify', detail: 'one skeptic per app with findings: reproduce minimally, classify' },
  ],
}

const REPO = '__ABSOLUTE_REPO_PATH__'
const APPS_ROOT = '__SCRATCH_DIR__/apps-r__N__'

// How a user gets the project, and how testers must build/run their apps. Examples:
//   JVM: 'The library is in mavenLocal as group G, version V: modules ... Build with REPO/gradlew -p <dir> ... --offline -Dorg.gradle.jvmargs=-Xmx512m'
//   Node: 'Install the packed tarball __TARBALL__ with npm i; run with node; never import from REPO/src'
//   Service: 'The service runs at http://localhost:PORT (started by the orchestrator); the API docs are REPO/docs/api.md'
const ARTIFACT_SETUP = `__HOW_TESTERS_GET_AND_BUILD_AGAINST_THE_ARTIFACT__`

const COMMON = (key) => `You are field-testing "__PROJECT__" (__ONE_LINE_DESCRIPTION__) by writing and RUNNING a realistic mini application against it, exactly as an external user would. This is ROUND __N__. You must (a) cover your scenario list, (b) re-check the listed regression checks, and (c) actively hunt for NEW problems — think adversarially about races, restarts, failures, hostile input and doc claims in your area beyond the list.

Setup rules:
- Source + docs (read-only!) are at ${REPO}. Start from the docs: __DOC_ENTRY_POINTS__. Read source only to diagnose surprising behaviour. NEVER modify anything under ${REPO}.
- ${ARTIFACT_SETUP}
- Create your app in ${APPS_ROOT}/${key} and use ONLY that directory (and ${APPS_ROOT}/${key}-* siblings you create). Keep memory/parallelism small; other agents build concurrently. If a build fails with a cache/lock/missing-class error that is not yours, wait and retry; never kill processes you did not start.
- Run every scenario; assert outcomes in code (non-zero exit / FAIL lines). Repeat race-prone scenarios several times. Timebox: thorough coverage, not perfection.
- When surprised, first rule out your own mistake. Report findings only with concrete evidence (exact output/log lines) and repro steps. Doc snippets that don't compile or don't match behaviour count as findings.
- Clean up background processes and containers you started.

Changes since the previous round (documented). Everything from earlier rounds still holds.
__CHANGES_SINCE_LAST_ROUND__

What to report (structured): every scenario with pass/fail (regression checks named "REGRESSION: ...", new ideas named "NEW: ..."), and findings of kind "bug", "doc", or "api-friction". No speculative findings.`

// 5-7 apps. Each: scenarios (stable), Regression checks (last round's fixes), NEW cases.
const APPS = [
  { key: '__app_key__', title: '__Realistic app title__', prompt: `Build __a concrete application__.
Scenarios:
1. __core usage scenario__
2. __...__
Regression checks (previous round's findings, now fixed — verify):
R1. __...__
NEW cases (not tried in any earlier round — spend real effort here): __one or two adversarial ideas__` },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    app_summary: { type: 'string' },
    app_dir: { type: 'string' },
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          result: { type: 'string', enum: ['passed', 'failed', 'blocked'] },
          notes: { type: 'string' },
        },
        required: ['name', 'result', 'notes'],
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['bug', 'doc', 'api-friction'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          title: { type: 'string' },
          what_happened: { type: 'string' },
          expected: { type: 'string' },
          repro_steps: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['kind', 'severity', 'title', 'what_happened', 'expected', 'repro_steps', 'evidence'],
      },
    },
  },
  required: ['app_summary', 'app_dir', 'scenarios', 'findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          classification: { type: 'string', enum: ['LIBRARY_BUG', 'DOC_BUG', 'API_FRICTION', 'USAGE_ERROR', 'NOT_REPRODUCED'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
          explanation: { type: 'string' },
          minimal_repro: { type: 'string', description: 'minimal code/commands with observed output; empty if not reproduced' },
          root_cause: { type: 'string', description: 'file:line in the project if identified, else empty' },
        },
        required: ['index', 'classification', 'severity', 'explanation'],
      },
    },
  },
  required: ['verdicts'],
}

const verifyPrompt = (app, report) => `You are a skeptical verifier. Another agent field-tested "__PROJECT__" (source + docs read-only at ${REPO}) with the app "${app.title}" in ${report.app_dir || APPS_ROOT + '/' + app.key} and reported the findings below.

${ARTIFACT_SETUP}

For EACH finding: read the relevant docs and source, then try to reproduce it with the smallest possible program under ${APPS_ROOT}/${app.key}-verify (you may reuse the tester's app). Classify:
- LIBRARY_BUG: the project misbehaves versus its documented/obvious contract (minimal_repro + root_cause file:line)
- DOC_BUG: behaviour is fine but docs say otherwise (quote the doc line)
- API_FRICTION: works as designed but a real user will trip over it
- USAGE_ERROR: the tester misused it; explain the correct usage
- NOT_REPRODUCED: could not reproduce after a genuine attempt
Be strict: default to USAGE_ERROR or NOT_REPRODUCED unless you have evidence. Never modify ${REPO}. Clean up processes/containers you start.

Findings (index -> finding):
${report.findings.map((f, i) => `[${i}] (${f.kind}, ${f.severity}) ${f.title}
  what happened: ${f.what_happened}
  expected: ${f.expected}
  repro: ${f.repro_steps}
  evidence: ${f.evidence}`).join('\n')}

Return one verdict per index.`

async function runApp(app) {
  const report = await agent(`${COMMON(app.key)}\n\nApp: ${app.title}\n${app.prompt}`, {
    label: `app:${app.key}`, phase: 'Build apps', schema: FINDINGS_SCHEMA,
  })
  if (!report) return { app: app.key, error: 'app agent failed' }
  const reg = report.scenarios.filter(s => s.name.startsWith('REGRESSION'))
  const nw = report.scenarios.filter(s => s.name.startsWith('NEW'))
  const ok = (xs) => xs.filter(s => s.result === 'passed').length
  log(`${app.key}: ${ok(report.scenarios)}/${report.scenarios.length} passed (regressions ${ok(reg)}/${reg.length}, new ${ok(nw)}/${nw.length}), ${report.findings.length} finding(s)`)
  if (report.findings.length === 0) return { app: app.key, report, verdicts: [] }
  const v = await agent(verifyPrompt(app, report), { label: `verify:${app.key}`, phase: 'Verify', schema: VERDICT_SCHEMA })
  return { app: app.key, report, verdicts: v ? v.verdicts : null }
}

// Two waves keep concurrent builds manageable; adjust the split to the machine.
const results = []
const half = Math.ceil(APPS.length / 2)
for (const wave of [APPS.slice(0, half), APPS.slice(half)]) {
  log(`wave: ${wave.map(a => a.key).join(', ')}`)
  const r = await parallel(wave.map(app => () => runApp(app)))
  results.push(...r.filter(Boolean))
}
return results
