# GTKX — Project Guidelines

## Architecture

GTKX is a pnpm + Turbo monorepo. The package map and the boundaries between the
native module, FFI, the React reconciler, CSS, and codegen live in
[docs/architecture.md](docs/architecture.md); the source of truth for the
package list is `pnpm-workspace.yaml`. The invariants below are the ones that
are **not** derivable from reading the code:

- Styling goes through `@gtkx/css` only — no inline styles or other CSS approaches.
- Generated FFI bindings (`packages/ffi/src/generated/`) are gitignored, so Glob won't see them — use `grep`/`find` in the terminal. If an API is in the `/girs` GIR, it is generated here; don't ask whether a GTK/GLib/Adw API is "supported".
- The native module holds only transport and GObject identity primitives, not GTK/GLib bindings, and is thoroughly tested — investigate it last when debugging.

## Commands

Run from the repo root. Anything that exercises GTK widgets (`@gtkx/e2e`,
`@gtkx/native`, `@gtkx/react`, and the like) needs Xvfb plus the GTK/Adwaita
runtime, which the host may lack (e.g. AlmaLinux 10 ships no Xvfb, producing
`Xvfb exited (code 127)`). **Wrap every GTK-touching command in
`scripts/docker-run`**, which runs it inside the `gtkx-ci:local` container. Pure
TS packages with no GTK dependency (e.g. `@gtkx/codegen`) run fine on the host
without the wrapper.

| Task                       | Command                                                        |
| -------------------------- | ------------------------------------------------------------- |
| All tests                  | `scripts/docker-run pnpm test` (Turbo per-package, cached)    |
| All tests, one process     | `scripts/docker-run pnpm test:all` (multi-project vitest)     |
| One package's tests        | `scripts/docker-run turbo test --filter=<package-name>`       |
| Lint (all / one)           | `scripts/docker-run pnpm lint` / `… turbo lint --filter=<package-name>` |
| Typecheck (all / one)      | `scripts/docker-run pnpm typecheck` / `… turbo typecheck --filter=<package-name>` |
| Codegen                    | `turbo codegen`                                               |
| Autofix lint               | `pnpm biome check --write`                                    |

Never run `npx tsc` directly — it does not work with project references; use
`turbo`. Never run `turbo test` at the repo root — it recurses; use `pnpm test`.

## Testing

- **Treat any GTK/GLib warning or error in test output (`Gtk-CRITICAL`, `GLib-GObject-WARNING`, `Adwaita-CRITICAL`, …) as a failure** and fix it immediately, even when the tests pass.
- The environment is not headless in behavior: it is a full GTKX application running under Xvfb, so all GTK APIs, signals, event controllers, widget activation, animations, and rendering behave exactly as on a real display.
- Stale `tsbuildinfo` can hide type errors: `pnpm typecheck` may report success while real errors exist, because `tsc -b` skips files via `*.tsbuildinfo` and Turbo caches the false success (e.g. codegen regenerates FFI signatures while react still uses the old shape). `pnpm run docs` (TypeDoc) and fresh CI checkouts surface it. To verify locally: `find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete && rm -rf .turbo packages/*/.turbo examples/*/.turbo && pnpm typecheck`.

## Debugging

Trace exactly where and why an error occurs; do not search blindly. Likely
sources, in order:

1. **Codegen** — generated bindings (logic in `packages/codegen`)
2. **Reconciler** — React node implementations (`packages/react/src/nodes/`)
3. **Native module** — well-tested; investigate last

Then identify the exact message and stack trace, classify it (codegen,
reconciler, or FFI), trace the call path from the React node through FFI to
native, and check the GIR definition against the expected API.

## Version control

Be pragmatic about git, not paranoid. When asked to commit, just commit —
including on top of existing commits, and even when the working tree or `HEAD`
looks mid-refactor. Don't interrogate repository state, second-guess earlier
commits, or ask for confirmation on routine commit/stage operations; the
maintainer manages branch history and will rebase or amend as needed. Reserve
caution for genuinely destructive, irreversible actions (force-pushing shared
branches, hard resets that discard work, history rewrites of pushed commits).
