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

## Add a version plan

Every pull request that changes a published package adds a version plan, the file `nx release` reads to pick the next version and to write the changelog entry:

```bash
pnpm plan
```

The prompt asks for the bump and for a changelog message. The message is what users read in the release notes, so write it for them.

Choose the bump that describes your change: `major` for a breaking change, `minor` for a feature, `patch` for a fix. It decides which heading the entry lands under, not the next version number. A release keeps the train it is already on, so while 2.0 is in beta every release is the next beta whatever the pending plans say, and a maintainer moves the train by hand. Ignore the `pre*` bumps; they belong to a maintainer cutting a prerelease from a stable version.

CI fails a pull request that touches a published package and adds no plan. Documentation, tests, and files outside `packages/` never need one, Dependabot is exempt, and the check is advisory rather than required, so a change that genuinely needs no entry can still merge.

## Publish a release

The Release PR workflow cuts a release from the pending version plans and never writes to `main` itself:

1. Run it from the Actions tab or with `gh workflow run release-pr.yml`. It also runs on its own whenever a merged pull request adds a version plan. Leave both inputs empty to stay on the current train, which means the next beta today and the bump the plans ask for once 2.0 is stable. Pass `specifier=2.0.0` to end the beta and cut the stable release, or `preid=rc` to rename the prerelease identifier. Both inputs release whether or not a plan is pending, so a maintainer can cut a version on demand.
2. The workflow versions every package, rewrites the tutorial ranges and the documentation pins, prepends the entry to `CHANGELOG.md`, deletes the consumed plans, and opens or refreshes the `release/next` pull request as the release bot, with a commit signed by GitHub. `pnpm prepare-release --dry-run` runs the same steps locally without writing anything.
3. Read the pull request and its checks, then advance `main` yourself. The ruleset allows only rebase merges, and a rebase merge drops every signature, so the merge button cannot produce a commit `main` accepts:

```bash
gh pr checks <number>
git fetch origin
git push origin origin/release/next:main
```

The push is a fast-forward of a commit that is already Verified, so it satisfies the `required_signatures` and `required_linear_history` rules on its own merits, and the pull request closes as merged. It bypasses the required status checks and the approving review because an organization admin bypasses the ruleset, so read `gh pr checks` yourself first. If `main` moved after the pull request was created, rerun the Release PR workflow rather than pressing "Update branch": updating by merge adds a second parent that the linear-history rule rejects, and updating by rebase rewrites the commit without a signature.

4. The Tag release workflow runs on that push. It creates the annotated `vX.Y.Z` tag, creates a draft GitHub release from the `CHANGELOG.md` entry, and dispatches the Publish workflow from the tag. It does nothing once that release is published, so an ordinary change to `packages/create-gtkx/package.json` is a no-op and a rerun after a failed publish redispatches the same draft. Curate the notes with `gh release edit vX.Y.Z --notes-file notes.md` when they need it.

The Release PR workflow authenticates as the GTKX release GitHub App, which needs read and write access to contents and pull requests. The repository variable `RELEASE_APP_CLIENT_ID` and the secret `RELEASE_APP_PRIVATE_KEY` hold its credentials.

The Publish workflow takes no inputs; the ref it is dispatched from is the whole request. Its `validate-release` job rejects a branch ref, a tag that is not `v` followed by the `version` in `packages/create-gtkx/package.json`, and a release that is not a draft. It then builds and publishes from `refs/tags/vX.Y.Z`, waits until every exact package version and dist-tag is visible on the registry, and only then publishes the draft without changing its notes and dispatches the Website workflow for the same tag, because a release published by the workflow's own token does not trigger it.

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
