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

The worktree is `/home/eugenio/gtkx-bughunt` on `bugfix/v1.0`. Scratch apps live outside it in
`/home/eugenio/gtkx-playground/`, so a hunt never dirties the source.

`/home/eugenio/gtkx-playground/bughunt-template` is a warm app with `@gtkx/*@1.0.0` from public npm,
all four GIR libraries bound, and a built codegen store. Hunters copy it instead of paying for
`npm install` every round.

## Running a round

```
Workflow({ scriptPath: "/home/eugenio/gtkx-bughunt/.bughunt/workflow.js",
           args: { round: N, personas: ["cli", "marshal", ...] } })
```

Personas rotate so every surface is covered over time rather than every round. The default set is the
seven highest-yield ones. The rotation:

| Round | Personas |
| --- | --- |
| odd | `cli`, `marshal`, `subclass`, `testkit`, `hotreload`, `higapp`, `lifecycle` |
| even | `scaffold`, `config`, `collections`, `styling`, `mcpdrive`, `deploy`, `docsconform` |

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

## The ledger

Append one line per finding. `status` moves through `candidate` → `confirmed` → `fixed`, or lands on
`rejected` / `wontfix`. Hunters read it before reporting, so a fixed defect is not rediscovered and a
`believed-fixed` one gets re-checked rather than re-reported.
