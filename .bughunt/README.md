# The AI userbase

A continuous bug hunt against released GTKX. Agents behave like users: they install the published
packages, build apps, run them, and report what breaks. Nothing here tests the source tree directly —
that is what the repository's own suites are for.

## Layout

| Path | What it is |
| --- | --- |
| `brief.md` | Rules, environment, and the oracles that count as proof. Every hunter reads it. |
| `personas.md` | Fourteen user personas, one surface each. A hunter is assigned exactly one. |
| `findings.jsonl` | The ledger. Every finding ever reported, with its status. Prevents rediscovery. |
| `workflow.js` | One hunt round: persona hunters, then two independent verifiers per finding. |
| `env.sh` | The environment a GTK app needs on this machine. |
| `run-headless.sh` | Runs a GTK command under a throwaway compositor and cleans up after it. |
| `count-strays.sh` | Counts leaked compositors, workers, and app processes. |

The worktree is `/home/eugenio/gtkx` on `bugfix/v1.0`. Scratch apps live outside it in
`/home/eugenio/gtkx-playground/`, so a hunt never dirties the source.

`/home/eugenio/gtkx-playground/bughunt-template` is a warm app with all four GIR libraries bound and a
built codegen store. Hunters copy it instead of paying for `npm install` every round.

It installs from a local Verdaccio serving **this branch**, not from public npm. Run
`.bughunt/refresh-template.sh` after every merge and before the next hunt: it republishes the workspace
and rebuilds the template against it. Without that step hunters test the shipped 1.0.0, which goes
stale the moment a fix lands — and, worse, cannot see a regression a fix introduced. That was true for
rounds 1 through 5, so their findings are all against 1.0.0.

## Running a round

```
Workflow({ scriptPath: "/home/eugenio/gtkx/.bughunt/workflow.js",
           args: { round: N, personas: ["cli", "marshal", ...] } })
```

Personas rotate so every surface is covered over time rather than every round. The default set is the
seven highest-yield ones. The rotation:

| Round | Personas |
| --- | --- |
| odd | `cli`, `marshal`, `subclass`, `testkit`, `hotreload`, `higapp`, `lifecycle`, `girzoo` |
| even | `scaffold`, `config`, `collections`, `styling`, `mcpdrive`, `deploy`, `docsconform` |

`girzoo` needs the writable sandbox worktree described in `brief.md`, because sanitizer reports cannot
be produced from an installed package.

`perf` is defined in `personas.md` but deliberately **not** in the rotation. Every other persona has a
severity floor — a crash, a hang, a wrong result, a leak — that makes findings run out as the defects
run out. Performance has none: something is always slower than something else, so the persona would
emit findings forever without converging. Run it only against a specific complaint, with a stated bar
to clear.

Both halves see every round's ledger, so a defect found by one persona is never re-reported by another.
`higapp` should build a different application each time it runs — the value is in unfamiliar
composition, not in repeating a known-good app.

## Why two verifiers

A hunter that wants to find bugs will find them whether or not they exist. Each report is therefore
handed to two agents that never spoke to the hunter:

- **Replay** starts from an empty directory and follows the reproduction literally, ten times. If the
  repro is not self-contained, it fails here — which is the point.
- **Attribute** asks whether GTKX is actually at fault, against the GTK4 C documentation, the ledger,
  and the source. GTK limitations, API misuse, environment artifacts, and duplicates die here.

A finding is confirmed only when both agree. Everything else is recorded as rejected, with the reason.

## Fixing in parallel

`fix-workflow.js` fixes findings one at a time in this worktree. That is safe and gives a linear
history, but it measured 10.5 hours of wall clock against 10.3 hours of agent time for one batch of
nine — effective parallelism 1.0 on a machine that allows 14 concurrent agents.

`fix-parallel.js` fixes them by group instead. Each group owns a disjoint set of packages and gets its
own git worktree, so groups run concurrently without racing on commits. Within a group, findings are
still sequential, and each fix's review overlaps the next fix.

```
.bughunt/prepare-groups.sh                       # one worktree per group, installed and built
Workflow({ scriptPath: ".bughunt/fix-parallel.js",
           args: { groups: [{ name, worktree, owns, findings: ["F203", ...] }] } })
.bughunt/merge-groups.sh                         # merge each fixgrp/* back, stopping on conflict
pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

Groups live in `groups.json`. The bound is the largest group, not the total: seven groups over 33
findings puts the longest at seven, so roughly a quarter of the serial time.

Two rules make the merges cheap, and both are in the agent prompts: stay inside your own worktree, and
only touch the packages your group owns. A fix that reaches outside its group must say so, so the merge
step knows where to expect a conflict.

## The ledger

Append one line per finding. `status` moves through `candidate` → `confirmed` → `fixed`, or lands on
`rejected` / `wontfix`. Hunters read it before reporting, so a fixed defect is not rediscovered and a
`believed-fixed` one gets re-checked rather than re-reported.
