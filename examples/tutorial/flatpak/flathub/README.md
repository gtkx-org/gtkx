# Flathub submission manifest

This directory contains a Flathub-ready manifest for the GTKX Tutorial. It differs
from the local manifest in `../com.gtkx.tutorial.yaml`:

| | `../com.gtkx.tutorial.yaml` (local) | `com.gtkx.tutorial.yaml` (Flathub) |
| --- | --- | --- |
| Source | `type: dir` on the working tree | pinned `git` commit |
| App bundle | pre-built on the host, copied in | built inside the sandbox |
| npm dependencies | resolved on the host (`pnpm`) | vendored offline, checksummed |
| Suitable for | a self-distributed `.flatpak` | a Flathub store submission |

Flathub requires that everything is built from pinned, checksummed sources inside
a network-isolated sandbox. This manifest satisfies that: all npm packages are
vendored into `generated-sources.json` and installed with `npm ci --offline`,
then the app is bundled and packed into a Node.js Single Executable Application
in-sandbox.

### Standalone overrides

The monorepo example is coupled to the workspace (`workspace:*` deps, a tsconfig
that extends `../../`, and `codegen: false` because the repo pre-generates the GI
bindings). The manifest overlays three self-contained files onto the app subdir so
it builds like a standalone gtkx app:

- `package.json` — pinned published `@gtkx/*` versions instead of `workspace:*`.
- `tsconfig.json` — self-contained, no monorepo `extends`/references.
- `gtkx.config.ts` — no `codegen: false`, so `gtkx build` generates the
  `@gtkx/gi` bindings in-sandbox from the runtime's GIR data
  (`/usr/share/gir-1.0` in `org.gnome.Sdk`). No network or display is needed.

This flow was verified end-to-end against a local Verdaccio registry: the whole
`@gtkx` graph (including the prebuilt `@gtkx/native-linux-x64-gnu`) was published,
vendored offline, built from source in-sandbox, and the resulting flatpak ran.

## Prerequisite: a publishable `@gtkx` release

The build resolves `@gtkx/*` from npm using the pinned versions in `package.json`.
Those versions must install cleanly with `npm`. **`@gtkx/components@0.21.0` on npm
currently ships `"@gtkx/react": "workspace:*"` in its `dependencies`**, which npm
cannot resolve (`EUNSUPPORTEDPROTOCOL`), so `generate-sources.sh` fails against
`0.21.0`. The release tooling already resolves workspace ranges correctly
(`pnpm pack` on `@gtkx/components` today emits `"@gtkx/react": "0.21.0"`), so cut a
fresh `@gtkx` release and pin `package.json` to it before submitting.

## Steps to submit

1. Set the `@gtkx/*` versions in `package.json` to a published, installable release.
2. Regenerate the vendored sources (needs network):

   ```sh
   pipx install flatpak-node-generator   # once
   ./generate-sources.sh
   ```

   This writes `package-lock.json` and `generated-sources.json`.
3. Pin the `commit` field in `com.gtkx.tutorial.yaml` to the exact release commit
   of the app source, and update the `<release>` entry in
   `../com.gtkx.tutorial.metainfo.xml`.
4. Commit `package.json`, `package-lock.json`, `generated-sources.json` and the
   real `../../assets/screenshot*.png`, then push so the screenshot URLs in the
   metainfo resolve.
5. Lint and build locally:

   ```sh
   pnpm --filter tutorial build:flatpak:hub
   flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest \
     flatpak/flathub/com.gtkx.tutorial.yaml
   ```
6. Open a pull request against [flathub/flathub](https://github.com/flathub/flathub)
   with the manifest, `generated-sources.json`, `package.json`,
   `package-lock.json` and the metainfo/desktop files.

For a standalone gtkx app (its own repo rather than this monorepo), drop the
`examples/tutorial` prefixes from the build commands and place `package.json`,
`package-lock.json` and `generated-sources.json` at the repo root.
