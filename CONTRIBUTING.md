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

## Documentation and examples

The VitePress site lives in `website/`. Run it through Nx from the repository root:

```bash
pnpm nx run @gtkx/website:build
pnpm nx run @gtkx/website:dev
```

The build generates API pages from package output. Run `pnpm build` before the first preview.

Examples are executable integration coverage. `examples/tutorial` is excluded from the workspace so it consumes registry packages like an external project; validate it against the working tree with `pnpm tutorial`.

Use [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) for questions, [issues](https://github.com/gtkx-org/gtkx/issues) for bugs, and the private channel in [SECURITY.md](SECURITY.md) for vulnerabilities.
