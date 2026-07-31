# syntax=docker/dockerfile:1
FROM ubuntu:26.04

ARG DEBIAN_FRONTEND=noninteractive

ENV LANG=C.UTF-8

# A dbgsym depends on an exact version of its library. ddebs carries the libadwaita
# dbgsym only for the release pocket, so -updates is held off for that source to keep
# libadwaita-1-0 and libadwaita-1-0-dbgsym on the one version both archives publish.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg ubuntu-dbgsym-keyring \
    && codename="$(. /etc/os-release; echo "$VERSION_CODENAME")" \
    && printf 'deb http://ddebs.ubuntu.com %s main restricted universe multiverse\ndeb http://ddebs.ubuntu.com %s-updates main restricted universe multiverse\ndeb http://ddebs.ubuntu.com %s-proposed main restricted universe multiverse\n' \
        "$codename" "$codename" "$codename" > /etc/apt/sources.list.d/ddebs.list \
    && printf 'deb http://archive.ubuntu.com/ubuntu %s-proposed main\n' "$codename" > /etc/apt/sources.list.d/proposed.list \
    && printf 'Package: *\nPin: release a=%s-proposed\nPin-Priority: 100\n\nPackage: src:gtk4\nPin: release a=%s-proposed\nPin-Priority: 600\n' \
        "$codename" "$codename" > /etc/apt/preferences.d/gtk4-proposed \
    && printf 'Package: src:libadwaita-1\nPin: release a=%s-updates\nPin-Priority: -1\n' \
        "$codename" > /etc/apt/preferences.d/libadwaita-updates \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libgtk-4-dev \
        libadwaita-1-dev \
        libgtksourceview-5-dev \
        libwebkitgtk-6.0-dev \
        libgirepository1.0-dev \
        gobject-introspection \
        gvfs \
        libgles2 \
        libgl1-mesa-dri \
        sway \
        weston \
        xwayland-run \
        dbus \
        git \
        gdb \
        valgrind \
        libasan8 \
        adwaita-icon-theme \
        gsettings-desktop-schemas \
        shared-mime-info \
        hicolor-icon-theme \
        librsvg2-common \
        fontconfig \
        fonts-noto-core \
        fonts-dejavu-core \
        libgtk-4-1-dbgsym \
        libadwaita-1-0-dbgsym \
        libglib2.0-0t64-dbgsym \
    && rm -rf /var/lib/apt/lists/*

COPY 60-gtkx-noto-sans.conf /etc/fonts/conf.d/60-gtkx-noto-sans.conf
RUN fc-cache -f

ARG NODE24_VERSION=24.18.1
ARG TARGETARCH
RUN set -eux \
    && case "${TARGETARCH}" in \
        amd64) node_arch=x64 ;; \
        arm64) node_arch=arm64 ;; \
        *) echo "unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://nodejs.org/dist/v${NODE24_VERSION}/node-v${NODE24_VERSION}-linux-${node_arch}.tar.xz" \
        | tar -xJ --strip-components=1 -C /usr/local \
    && node --version | grep -q "v${NODE24_VERSION}"

RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@latest --activate

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH="/usr/local/cargo/bin:${PATH}"

ENV CARGO_NET_RETRY=10
ENV RUSTUP_MAX_RETRIES=10
ENV CARGO_HTTP_MULTIPLEXING=false

# Keep in sync with /rust-toolchain.toml (stable) and scripts/rust-nightly.ts (nightly), which pin
# the same toolchains for local builds; the image is built without the repository checked out.
ARG RUST_VERSION=1.97.1
ARG RUST_NIGHTLY=nightly-2026-07-30
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --component clippy --component rustfmt --component llvm-tools-preview --default-toolchain "${RUST_VERSION}" \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN rustup toolchain install "${RUST_NIGHTLY}" --profile minimal --component llvm-tools-preview --component rust-src --component miri --component rustfmt \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN cargo install cargo-llvm-cov --locked \
    && chmod -R a+rwX "$CARGO_HOME"

RUN if [ -d /usr/share/vulkan/icd.d ]; then \
        find /usr/share/vulkan/icd.d -type f -name '*.json' ! -name 'lvp_icd*' -delete; \
    fi

ENV CARGO_INCREMENTAL=0

LABEL org.opencontainers.image.source="https://github.com/gtkx-org/gtkx"
LABEL org.opencontainers.image.description="GTKX CI Base Image with GTK4, Node.js, Rust, and testing dependencies"
