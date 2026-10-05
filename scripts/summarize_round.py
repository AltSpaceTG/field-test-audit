#!/usr/bin/env python3
"""Summarize a field-test round from the Workflow output JSON.

Usage: summarize_round.py <workflow-output.json> [out.txt]

The Workflow task output is a JSON object with "logs" (list of str) and "result"
(list of {app, report:{scenarios, findings}, verdicts}). Prints the per-app log
lines, every scenario that did not pass, and every finding with its verdict.
"""
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    with open(sys.argv[1]) as f:
        data = json.load(f)
    out = []
    out.extend(data.get("logs", []))
    totals = {"scenarios": 0, "passed": 0, "verified": 0}
    for r in data.get("result", []):
        rep = r.get("report") or {}
        out.append(f"\n===== {r.get('app')}" + (f"  ERROR: {r['error']}" if r.get("error") else ""))
        for s in rep.get("scenarios", []):
            totals["scenarios"] += 1
            if s["result"] == "passed":
                totals["passed"] += 1
            else:
                out.append(f" SCEN {s['result']} {s['name']} :: {s['notes'][:300]}")
        verdicts = {v["index"]: v for v in (r.get("verdicts") or [])}
        for i, f in enumerate(rep.get("findings", [])):
            v = verdicts.get(i, {})
            cls = v.get("classification")
            if cls in ("LIBRARY_BUG", "DOC_BUG", "API_FRICTION"):
                totals["verified"] += 1
            out.append(
                f" [{i}] {f['kind']}/{f['severity']} {f['title']}\n"
                f"    -> {cls}/{v.get('severity')}: {v.get('explanation', '')[:600]}\n"
                f"    root: {v.get('root_cause', '')[:200]}"
            )
    out.append(
        f"\nTOTAL: {totals['passed']}/{totals['scenarios']} scenarios passed, "
        f"{totals['verified']} verified finding(s)"
    )
    text = "\n".join(out)
    print(text)
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w") as f:
            f.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
