---
title: "GTKX 1.6: Agents and the road to 2.0"
description: "GTKX 1.6 gives coding agents project-specific rules, a generated GTK API reference, one-command MCP setup, and guided opt-ins for Adwaita defaults and tree-shakeable stores on the road to GTKX 2.0."
image: /og.png
---

# GTKX 1.6

<p class="post-date">August 29, 2026</p>

GTKX 1.6 is the migration release before 2.0. It gives coding agents instructions and API documentation generated for the project they are editing, makes the MCP server a first-class CLI command, and tells every existing project exactly which 2.0 behaviors it has not adopted yet. Two new future flags let applications opt into Adwaita as a default library and tree-shakeable generated bindings now. Existing application semantics stay on 1.5 behavior until those flags are enabled. Read the [`changelog`](https://github.com/gtkx-org/gtkx/releases/tag/v1.6.0) for the full list of changes.

## The GTK API your agent can actually use

A coding model has seen a great deal of GTK, but most of it is C, PyGObject, Vala, or GJS. That knowledge is actively misleading in a GTKX project: children are JSX, signals are props, prop names are camelCase, and the available libraries are whatever this project's GIR configuration generated.

Codegen now writes two project-specific inputs that keep an agent on that surface. `.gtkx/reference` contains the same element pages as `gtkx docs`, generated from the project's own libraries and element configuration. Each page names the hierarchy, child slots, props, signals, and ref methods that actually exist. A marked block in `AGENTS.md` records the GTKX rules models most often get wrong and points them at that reference before they write widget code.

Only the marked block belongs to GTKX. Codegen preserves everything around it, updates the block when bindings change, and creates a `CLAUDE.md` import only when that file does not already exist. Both outputs are on by default and can be controlled independently:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    agents: {
        rules: true,
        reference: true,
    },
});
```

The generated reference is disposable, and new scaffolds keep it out of version control; the small `AGENTS.md` block can be committed so a clean checkout begins with the same instructions.

## Connect an editor, then close the loop

`gtkx mcp` now runs the project-matched MCP server through the CLI. `gtkx mcp init` writes that server into the configuration an editor already reads:

```bash
npx gtkx mcp init --client claude
```

The command supports Claude, Cursor, VS Code, and OpenCode project files while preserving other configured servers. Codex keeps its servers in a global TOML file, so the Codex target prints the exact snippet to paste rather than editing a file outside the project. New projects already include the Claude-compatible `.mcp.json` entry.

Once `gtkx dev` is running, an agent can inspect the live widget tree, query the same roles, names, labels, and text used by `@gtkx/testing`, click and type, fire a signal, and take a screenshot. The reference tools search and return the generated API without a running window. That closes the same edit, refresh, inspect, and verify loop a developer uses instead of asking a model to declare victory from source alone.

A project can keep that surface small. `mcp.tools` accepts additive and subtractive glob patterns, and `mcp.readOnly` removes the tools that drive the application. Command-line flags override both for an editor that needs a narrower server. Tools also carry MCP read-only and destructive annotations, and screenshots can be written to disk without placing the image in the conversation until the client needs to inspect it. The [MCP guide](/guide/mcp) covers every client and tool.

## 1.6 tells you exactly what 2.0 will change

GTKX 2.0 is deliberately a removal release: it makes the already available future behaviors unconditional and removes deprecated paths. Feature work resumes in 2.1. The work for an application therefore belongs on 1.6, where each change can be adopted independently and verified against the current release.

Every command that loads `gtkx.config.ts` now prints one grouped warning on stderr when future flags remain unset. The block names each flag, explains the behavior it changes, gives it a stable deprecation ID, and links to the new [Upgrading to 2.0](/guide/upgrading-to-2) guide. It prints once for a given set of pending flags, so a dev server does not repeat it through every process it starts.

Set one flag, run `tsc`, and fix the call sites its new type exposes. Resource imports are checked by the build instead, and the default-library flag asks for a manual application check because neither the typechecker nor the build can decide whether loading Adwaita was intended. A warning can be acknowledged temporarily through `deprecations.silence`, but it still counts as unset and still changes under 2.0.

## Adwaita as a default, opt in today

GTKX has always generated `Gtk-4.0` unless a project pinned another GTK version. `future.v2DefaultLibraries` adds `Adw-1` on the same terms:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2DefaultLibraries: true },
});
```

With the flag on, `libraries` names what the project needs in addition to GTK and Adwaita. A pinned GTK or Adwaita version remains pinned, while redundant default entries are reported so they can be removed. Packages built on Adwaita, including `@gtkx/components/adw`, `@gtkx/forms`, and `@gtkx/navigation`, no longer need every application to repeat the same library entry.

Binding Adwaita changes generated types, package dependencies, and notices, but does not initialize or restyle an application by itself. That happens when code imports the generated Adwaita module, directly or through a package or the flat `@gtkx/jsx` entry. Turn the flag on, import the surface the application needs, and look at the running app. New scaffolds already opt into this behavior.

## Smaller production bundles

Generated stores previously registered every class as soon as a namespace loaded, which made every binding a side effect the bundler had to retain. `future.v2TreeShaking` folds each registration and its metadata into the class definition that needs it. Rendered elements, classes used directly, and types referenced by their signatures remain; the rest can leave the production bundle.

Across all six example applications, enabling the flag reduced their combined minified production JavaScript from 36.74 MB to 22.13 MB, a 39.8% reduction. Focused applications shed between 47.7% and 60.6%; GTK Demo dropped 10.6% because its large demo source payload and broad binding surface dominate the bundle. The measured median startup to the first mapped window was 5.3% to 30.0% lower in five examples, while Animations was effectively unchanged.

| Example | Bundle off | Bundle on | Reduction |
| --- | ---: | ---: | ---: |
| Animations | 5.04 MB | 1.99 MB | 60.6% |
| Browser | 4.74 MB | 2.48 MB | 47.8% |
| GTK Demo | 10.65 MB | 9.52 MB | 10.6% |
| Hello World | 3.81 MB | 1.86 MB | 51.3% |
| Navigation | 4.34 MB | 2.27 MB | 47.7% |
| Tutorial | 8.16 MB | 4.02 MB | 50.7% |

| Example | Startup off, median (IQR) | Startup on, median (IQR) | Change |
| --- | ---: | ---: | ---: |
| Animations | 198.1 ms (195.3–212.5) | 196.4 ms (194.4–210.3) | −0.9% |
| Browser | 248.0 ms (246.2–269.9) | 196.5 ms (194.6–211.2) | −20.8% |
| GTK Demo | 356.3 ms (309.0–400.8) | 337.3 ms (293.7–388.0) | −5.3% |
| Hello World | 200.8 ms (192.3–207.4) | 140.6 ms (137.3–148.7) | −30.0% |
| Navigation | 240.8 ms (230.1–258.3) | 180.3 ms (173.2–191.6) | −25.1% |
| Tutorial | 286.0 ms (233.6–299.6) | 222.7 ms (191.7–235.5) | −22.1% |

Both variants start from the GTKX 1.6 source at commit `76c6292f`; only `future.v2TreeShaking` differs. Bundle size is the raw decimal size of the minified `dist/bundle.mjs`; the native addon, resources, and assets are unchanged and excluded. The startup builds add the same readiness handler to both variants. Startup was measured on an AMD Ryzen 7 9700X with Fedora 44, Node 24.19.0, GTK 4.22.4, libadwaita 1.9.3, and Weston 15.0.1. Each value is the median of 30 alternating fresh-process launches after five warm-ups per variant under one headless Weston compositor with Cairo software rendering. The timer runs from spawning Node to the primary application window's first `map` signal. These are warm-filesystem window-mapping measurements, not cold-disk startup, first painted frame, or WebKit network completion.

The flag changes reachability rather than TypeScript types. A side-effect-only `import "@gtkx/gi/gtk"` still initializes the namespace but retains no class; import a value when its type must register. `GObject.typeFromName` follows GLib's normal contract and finds generated types that the process has registered, so code performing a lookup by name must retain the corresponding class. Development and tests keep the complete store and behave as before.

Animations participate without giving up shaking. Prefer the callable form with an imported component:

```tsx
import { animated } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);
```

The old `animated.GtkLabel` property form remains in 1.6 but is deprecated for 2.0. A dynamic use such as spreading `animated` or calling `Object.keys` has to retain every widget, and `gtkx build` names the file so the lost optimization is visible.

## Also in 1.6

Source-import discovery now skips every hidden directory rather than special-casing `.git` and `.gtkx`, so a schema or resource import in an editor cache or local scratch directory cannot leak into generated declarations or a build.

The workspace now patches React Navigation's package exports instead of carrying a TypeScript path override. Type resolution consistently selects its published declarations, and GTKX's navigation package and example compile under the same configuration as their consumers.

The CLI's large codegen and deploy integration suites were split by user scenario and now exercise the built CLI in subprocesses. Coverage output is smaller and its SonarCloud job has more capacity; those changes do not alter application APIs, but they make the release path exercise what is actually published.

## Upgrading

GTKX 1.6 has no application-facing runtime break by default. Upgrade every installed GTKX package together:

```bash
npm install @gtkx/cli@^1.6.0 @gtkx/react@^1.6.0
```

Update the other `@gtkx/*` packages the application uses in the same command. The first CLI run may add the managed agent block and will report any future flags the project has not adopted. Work through those flags one at a time using the typechecker, build, or live application check named by the warning. Clear the GTKX symbols tagged `Removed in v2` as well; once both lists are empty, the eventual 2.0 upgrade is only a version bump.

## What's next

GTKX 2.0 removes the deprecated paths and future-flag branches documented by 1.6, without adding a second set of changes at the same time. Applications can complete that migration now, on stable behavior with explicit checks. New feature work resumes in 2.1.
