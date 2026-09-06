# Contributing to GTKX

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report conduct concerns to eugeniodepalo@gmail.com.

## Set up the workspace

You need Linux, Node.js 26.7 or later, pnpm, stable Rust, and nightly `rustfmt`:

```bash
rustup toolchain install nightly --profile minimal --component rustfmt
```

Codegen needs GIR development files for every workspace library. On Debian or Ubuntu:

```bash
sudo apt install build-essential pkg-config gobject-introspection \
    libgirepository1.0-dev libgtk-4-dev libadwaita-1-dev \
    libgtksourceview-5-dev libwebkitgtk-6.0-dev meson ninja-build
```

Distribution names vary; [.github/docker/Dockerfile](.github/docker/Dockerfile) is the authoritative dependency list. Meson and Ninja build the GObject introspection fixtures. Released GStreamer versions can crash looping `GtkVideo` or `GtkMediaFile` tests, so repository demos must not enable media looping until the upstream race is fixed.

```bash
git clone https://github.com/YOUR_USERNAME/gtkx.git
cd gtkx
pnpm install
pnpm build
```

## Submit a focused change

Use a short imperative commit subject of at most ten words. Before opening a pull request, run the checks relevant to the change:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Include a screenshot for visible UI changes and link the issue the change closes.

Breaking removals require a warning in an earlier minor release. Renamed symbols use `@deprecated` with their introduction version; behavior changes need a CLI warning and an opt-in migration path. A removal-only major adds no unrelated features, and its migration guide changes with every deprecation.

## Publish a release

A release commit has to reach `main` carrying your own signature. Open the release pull request as usual and wait for its checks to finish, then advance `main` to the signed commit yourself instead of merging in the web UI:

```bash
gh pr checks <number>
git fetch origin main
git log -1 --show-signature release/vX.Y.Z
git push origin release/vX.Y.Z:main
```

`commit.gpgsign` signs the release commit when you make it, so the push is a fast-forward of a commit you signed. That satisfies the `required_signatures` and `required_linear_history` rules on `main` on their own merits, and the pull request closes as merged once its commit is reachable. Merging in the web UI instead replaces your signature with GitHub's, and `gh pr merge --rebase --admin` replays the commit without any signature at all, which is how PR #619 reached `main` unsigned.

The push bypasses two rules, because an organization admin bypasses the ruleset: the required status checks, and the approving review. Nothing else re-checks them, so read `gh pr checks` yourself and push only when every check has passed. Confirm the commit on `main` is still marked Verified before tagging it.

Create a signed tag for the package version and push that exact tag:

```bash
git fetch origin main --tags
git log -1 --show-signature origin/main
git tag -s vX.Y.Z origin/main -m "vX.Y.Z"
git push origin refs/tags/vX.Y.Z
```

Write the complete curated release notes, then create a draft release for the existing tag and dispatch the Publish workflow explicitly from that tag:

```bash
gh release create vX.Y.Z --draft --prerelease --title vX.Y.Z --notes-file notes.md
gh workflow run publish.yml --ref vX.Y.Z
```

Drop `--prerelease` for a stable release. The draft has to exist before the workflow runs, and the notes are final once it does.

The workflow takes no inputs; the ref it is dispatched from is the whole request. Its `validate-release` job rejects a branch ref, a tag that is not `v` followed by the `version` in `packages/create-gtkx/package.json`, and a release that is not a draft. It then builds and publishes from `refs/tags/vX.Y.Z`, waits until every exact package version and dist-tag is visible on the registry, and only then publishes the draft without changing its notes and dispatches the Website workflow for the same tag, because a release published by the workflow's own token does not trigger it.

The visibility wait gives each package ten minutes by default; the registry took three to four minutes to expose the beta 5 packages. `GTKX_PUBLISH_VISIBILITY_TIMEOUT_MS`, a positive integer number of milliseconds, overrides that limit for a run of `pnpm release` or of the publish scripts, and an invalid value fails the publish before anything is uploaded.

If any build, publish, or registry check fails, the GitHub release remains a draft. Fix the cause and rerun the workflow on the same tag. A package the registry already holds is skipped, and the wait then checks only that its exact version is visible rather than its dist-tag, while missing packages continue publishing.

## Documentation and examples

The VitePress site lives in `website/`. Run it through Nx from the repository root:

```bash
pnpm nx run @gtkx/website:build
pnpm nx run @gtkx/website:dev
```

The build generates API pages from package output. Run `pnpm build` before the first preview.

Examples are executable integration coverage. `examples/tutorial` is excluded from the workspace so it consumes registry packages like an external project; validate it against the working tree with `pnpm tutorial`.

Use [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) for questions, [issues](https://github.com/gtkx-org/gtkx/issues) for bugs, and the private channel in [SECURITY.md](SECURITY.md) for vulnerabilities.
