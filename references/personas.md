# Personas and checklists

Pick 5-7 personas per round. Keep the core personas stable across rounds (their scenario lists
become the regression baseline) and rotate the NEW cases inside them. Make each persona a
*concrete* application with a domain ("e-commerce catalog", "multi-tenant billing SaaS"), not an
abstract "test feature X" — realistic apps hit realistic combinations.

## Contents
- Universal angles (any project)
- Library / SDK
- Web service / HTTP API
- Web frontend
- CLI tool
- Data / batch pipeline
- Security checklist
- Ideas for NEW cases

## Universal angles

| Angle | What the persona does |
|---|---|
| Happy path, by the docs | Builds the app following getting-started and guides literally; every doc snippet must compile and behave as written. |
| Security / multi-tenant | Tries to break isolation and authz; works through the security checklist below. |
| Ops / failure | Kills processes mid-operation, fills disks, makes dirs read-only, cuts the DB, restores backups, uses the admin tooling. |
| Evolution / upgrade | Changes config, schema, data shape and versions while running; rolls back; mixes old and new versions. |
| Observability / soak | Runs a long load with metrics/tracing/logs; checks invariants (counters add up, no leaks, no hung requests, bounded threads/memory). |
| Integration / second language or platform | Uses bindings, another language, framework integration, or a real neighbour (DB pooler, proxy, replica, queue). |
| Scale / limits | Large inputs, many entities, long histories; measures and compares against documented limits and sizing advice. |

## Library / SDK
- Consume from the package repository like an outsider (fresh project, only the public API).
- Concurrency: many threads/coroutines; cancellation and interruption; timeouts; close/shutdown
  while busy; re-entrancy from callbacks (calling the library from its own callbacks).
- Persistence and restart: crash at every interesting step (kill -9), restart, compare state.
- Contracts: SPI implementations against the published contract tests; error types and messages
  match the docs; thread-safety claims.
- Packaging: module descriptors/exports, optional dependencies, shading, minimal runtime deps.

## Web service / HTTP API
- AuthN/AuthZ matrix per endpoint and role (anonymous, other tenant, expired token, wrong scope).
- Input validation: oversized bodies, wrong content types, unicode, nulls, negative/huge numbers,
  duplicate keys, deeply nested JSON.
- Idempotency and retries (double submit, retry after timeout), pagination edges, concurrency on
  the same resource (lost updates), rate limits.
- Failure of dependencies (DB down, slow, read-only replica), graceful shutdown with in-flight
  requests, startup with missing config.
- Error responses leak nothing (stack traces, SQL, internal ids, secrets).

## Web frontend
- Every button/flow end to end in a real browser (click-path); state after back/forward/reload;
  two tabs at once; slow network; session expiry mid-flow.
- XSS through every rendered field, open redirects, CSRF on state-changing actions, sensitive
  data in local storage / URLs / logs.
- Accessibility basics and responsive layout as found issues, not nitpicks.

## CLI tool
- Every subcommand and flag from `--help` and the docs; exit codes; behaviour on bad input, on
  missing/locked/corrupt files, on huge files, on pipes and non-TTY output.
- Never destroys user data without confirmation; dry-run modes really are dry; paths with
  spaces/unicode/symlinks.

## Data / batch pipeline
- Re-runs are idempotent; partial failure mid-batch and resume; late/duplicate/out-of-order data;
  schema drift; empty and huge inputs; time zones and DST; correctness against a brute-force
  recomputation.

## Security checklist (security persona works through all that apply)
- **Deserialization**: untrusted bytes reach a deserializer? allowlists/filters in place? Try a
  gadget-like class name.
- **Injection**: SQL, shell, path traversal, template, header, log injection (newlines in input
  that end up in logs).
- **AuthZ / isolation**: tenant A reaching tenant B's data via ids, names, routing, caches, error
  messages, metrics labels, logs.
- **Secrets**: in logs, metrics, exceptions, dumps, persisted data, URLs, server-side statement
  logging of a database.
- **Integrity**: tampered persisted files/rows detected (checksums are not MACs — say so);
  corruption on a *running* system not laundered into a new "clean" copy by compaction/backup.
- **Resource exhaustion**: unbounded queues, caches, retries, threads, file handles, native/direct
  memory; one tenant starving others; amplification (small request → big work).
- **Crash consistency**: kill -9 at each step of every multi-step write; recovery never invents or
  loses committed data.
- **Defaults**: secure by default? Anything dangerous on by default (debug endpoints, permissive
  serializers, deleting archives/backups)?
- **Concurrency**: TOCTOU around checks and locks; double execution; leadership/fencing in
  multi-node setups (two writers after a network partition or pooler in front of session locks).

## Ideas for NEW cases (rotate, one or two per app per round)
- Restart in the middle of every long operation; restart with a different version of the app.
- Rollback after an upgrade; blue/green with two versions sharing state.
- Disaster drill: corrupt the data in the middle (not just the tail), then follow the documented
  repair procedure end to end.
- The operator workflow from the docs, done literally (backup, restore, purge, migrate, rotate).
- Real neighbours: connection poolers in transaction mode, read replicas, proxies with timeouts,
  statement timeouts, idle-session killers.
- Observability-only diagnosis: can an operator reconstruct what happened from logs alone?
- A second language binding / framework integration under load.
- Long-term evolution: thousands of config/graph changes in random order, then compare the
  persisted state with the live state.
- Quotas, eviction, migrating a tenant/user between instances with public APIs only.
