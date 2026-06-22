FROM ubuntu:26.04

# Build-only; keeps apt non-interactive without persisting into the runtime env.
ARG DEBIAN_FRONTEND=noninteractive

# A UTF-8 locale is always present on Ubuntu as C.UTF-8; setting it keeps GLib
# and Pango from emitting locale warnings the test suite treats as failures.
ENV LANG=C.UTF-8

# The GTK/Adwaita build and runtime stack, GObject-introspection (codegen reads
# the system GIR at /usr/share/gir-1.0), the GStreamer media backend, icon
# themes and fonts for rendering, and the debug/test toolchain. The ddebs
# repository supplies the GLib/GTK/Adwaita debug symbols so AddressSanitizer and
# Valgrind backtraces resolve to source.
#
# The bindings target GTK 4.22.4; 26.04 releases with 4.22.2 and stages the
# 4.22.4 bugfix in -proposed (Ubuntu-built, so it resolves against the release).
# Pinning only the gtk4 source there — runtime, headers, GIR, and debug symbols
# together — makes layout and text metrics match the target exactly while every
# other package stays on the release pocket.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg ubuntu-dbgsym-keyring \
    && codename="$(. /etc/os-release; echo "$VERSION_CODENAME")" \
    && printf 'deb http://ddebs.ubuntu.com %s main restricted universe multiverse\ndeb http://ddebs.ubuntu.com %s-updates main restricted universe multiverse\ndeb http://ddebs.ubuntu.com %s-proposed main restricted universe multiverse\n' \
        "$codename" "$codename" "$codename" > /etc/apt/sources.list.d/ddebs.list \
    && printf 'deb http://archive.ubuntu.com/ubuntu %s-proposed main\n' "$codename" > /etc/apt/sources.list.d/proposed.list \
    && printf 'Package: *\nPin: release a=%s-proposed\nPin-Priority: 100\n\nPackage: src:gtk4\nPin: release a=%s-proposed\nPin-Priority: 600\n' \
        "$codename" "$codename" > /etc/apt/preferences.d/gtk4-proposed \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libgtk-4-dev \
        libadwaita-1-dev \
        libgtksourceview-5-dev \
        libwebkitgtk-6.0-dev \
        libvte-2.91-gtk4-dev \
        libsoup-3.0-dev \
        libjson-glib-dev \
        libgtk4-layer-shell-dev \
        libgstreamer1.0-dev \
        libgstreamer-plugins-base1.0-dev \
        libxml2-dev \
        libsecret-1-dev \
        libatspi2.0-dev \
        libappstream-dev \
        libgirepository1.0-dev \
        gobject-introspection \
        gir1.2-gstreamer-1.0 \
        gir1.2-gst-plugins-base-1.0 \
        gvfs \
        libgles2 \
        libgl1-mesa-dri \
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

# Pin the sans-serif generic to Noto Sans so headless GTK text metrics match the
# pinned runtime; the build-time cache refresh keeps the first test run cheap.
COPY 60-gtkx-noto-sans.conf /etc/fonts/conf.d/60-gtkx-noto-sans.conf
RUN fc-cache -f

# The test suite targets weston 15 (the version the dev environment runs); Ubuntu
# 26.04 only packages weston 14, whose headless backend is unstable under the GTK
# drag-and-drop tests. Build weston 15.0.1 from the pinned upstream tarball into
# /usr/local so it takes PATH precedence over the apt weston that xwayland-run
# pulls in for `wlheadless-run`. build-dep (via deb-src) supplies the full build
# dependency set, so the headless backend and pixman/GL renderers the tests use
# are all available. The SHA-256 pins the release tarball under the image hash.
ARG WESTON_VERSION=15.0.1
RUN sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources \
    && apt-get update \
    && apt-get build-dep -y weston \
    && apt-get install -y --no-install-recommends meson ninja-build \
    && curl -fsSL -o /tmp/weston.tar.xz \
        "https://gitlab.freedesktop.org/wayland/weston/-/releases/${WESTON_VERSION}/downloads/weston-${WESTON_VERSION}.tar.xz" \
    && echo "551d039bfb0c837ba5a4d027cdb8ee16bded0eedb789821f8025d8a64b791f6d  /tmp/weston.tar.xz" | sha256sum -c - \
    && mkdir -p /tmp/weston-src \
    && tar -xJf /tmp/weston.tar.xz --strip-components=1 -C /tmp/weston-src \
    && meson setup /tmp/weston-src/build /tmp/weston-src --prefix=/usr/local --buildtype=release \
        -Dbackend-headless=true -Dbackend-default=headless \
        -Dbackend-drm=false -Dbackend-pipewire=false -Dbackend-rdp=false \
        -Dbackend-vnc=false -Dbackend-wayland=false -Dbackend-x11=false \
        -Drenderer-gl=true -Drenderer-vulkan=false \
        -Dxwayland=false -Dsystemd=false -Dremoting=false -Dpipewire=false \
        -Dshell-desktop=true -Dshell-ivi=false -Dshell-kiosk=false -Dshell-lua=false \
        -Dcolor-management-lcms=false -Dimage-jpeg=false -Dimage-webp=false \
        -Ddemo-clients=false -Dresize-pool=false \
        -Dwcap-decode=false -Dtests=false -Dtest-junit-xml=false \
    && ninja -C /tmp/weston-src/build install \
    && ldconfig \
    && rm -rf /tmp/weston-src /tmp/weston.tar.xz /var/lib/apt/lists/* \
    && weston --version | grep -q "weston ${WESTON_VERSION}"

# Node 26 is the default runtime; a secondary Node 22 lives in /opt/node22 for
# the CodSpeed reconciler benches, whose @codspeed/core native addon uses a V8
# symbol Node 26 has dropped. Both come from nodejs.org at exact patch versions
# so the image stays reproducible under its content hash; bump these deliberately.
ARG NODE26_VERSION=26.3.1
ARG NODE22_VERSION=22.23.0
RUN set -eux \
    && curl -fsSL "https://nodejs.org/dist/v${NODE26_VERSION}/node-v${NODE26_VERSION}-linux-x64.tar.xz" \
        | tar -xJ --strip-components=1 -C /usr/local \
    && mkdir -p /opt/node22 \
    && curl -fsSL "https://nodejs.org/dist/v${NODE22_VERSION}/node-v${NODE22_VERSION}-linux-x64.tar.xz" \
        | tar -xJ --strip-components=1 -C /opt/node22 \
    && node --version | grep -q "v${NODE26_VERSION}" \
    && /opt/node22/bin/node --version | grep -q "v${NODE22_VERSION}"

RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@latest --activate

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH="/usr/local/cargo/bin:${PATH}"

# Retry network operations and force HTTP/1.1 for crates.io transfers: the
# crates.io CDN intermittently aborts multiplexed HTTP/2 streams ("Error in the
# HTTP2 framing layer"), which `cargo install` surfaces as a hard failure. These
# must precede the rustup/cargo-install layers below so they cover those fetches,
# not just the jobs that later run in this image.
ENV CARGO_NET_RETRY=10
ENV RUSTUP_MAX_RETRIES=10
ENV CARGO_HTTP_MULTIPLEXING=false

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --component clippy --component llvm-tools-preview --default-toolchain stable \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN rustup toolchain install nightly --profile minimal --component llvm-tools-preview --component rust-src --component miri \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN cargo install cargo-llvm-cov --locked \
    && chmod -R a+rwX "$CARGO_HOME"

RUN cargo install cargo-codspeed --locked \
    && chmod -R a+rwX "$CARGO_HOME"

# The CodSpeed runner instruments and uploads the benchmarks, so the bench job
# runs it directly inside the container instead of wrapping a host action around
# docker-run. Pin the runner version: the unversioned install.sh tracks latest,
# and each runner hard-codes the exact valgrind-codspeed iteration it expects
# (see below), so the two must be bumped together.
RUN curl -fsSL https://github.com/CodSpeedHQ/codspeed/releases/download/v4.17.6/codspeed-runner-installer.sh | bash \
    && install -m 0755 "$(find / -name codspeed -type f -path '*bin*' 2>/dev/null | head -1)" /usr/local/bin/codspeed \
    && codspeed --version \
    && chmod -R a+rwX "$CARGO_HOME"

# CodSpeed publishes its patched valgrind only for Ubuntu 22.04/24.04. On 26.04
# the runner classes its executor as "requires manual installation" and skips
# its own download only when a `.codspeed` valgrind matching the iteration it
# pins is already present; otherwise it tries to fetch one and bails with
# "Unsupported system". Install the 24.04 build of that exact iteration —
# 3.26.0-0codspeed3 for runner v4.17.6 above — so `codspeed run` instruments
# here. Bump this in lockstep with the pinned runner. The SHA-256 matches the
# runner's own pinned artifact.
RUN url="https://github.com/CodSpeedHQ/valgrind-codspeed/releases/download/3.26.0-0codspeed3/valgrind_3.26.0-0codspeed3_ubuntu-24.04_amd64.deb" \
    && curl -fsSL -o /tmp/valgrind-codspeed.deb "$url" \
    && echo "e6da56bd90d7a22ed451c2108002a3f172914c77c705d0c8c4fedf6196830dee  /tmp/valgrind-codspeed.deb" | sha256sum -c - \
    && apt-get update \
    && apt-get install -y --no-install-recommends --allow-downgrades /tmp/valgrind-codspeed.deb \
    && rm -f /tmp/valgrind-codspeed.deb \
    && rm -rf /var/lib/apt/lists/* \
    && valgrind --version | grep -q codspeed

# Ubuntu 26.04 ships the uutils (Rust) coreutils as the default provider, so
# /bin/echo, /usr/bin/env and ~100 other utilities are symlinks into a single
# multicall binary that picks its applet from its own executable identity. Under
# `valgrind --tool=callgrind` — how CodSpeed instruments the benches — that
# identity misreads as valgrind's tool binary `callgrind-amd64-linux`, so every
# coreutils call the bench spawns exits non-zero with
# "coreutils: unknown program 'callgrind-amd64-linux'", which the runner surfaces
# as "failed to execute valgrind". GNU coreutils picks its applet from argv[0] and
# is immune, so point each uutils symlink at the GNU build that gnu-coreutils
# installs as /usr/bin/gnu<name>. coreutils-from-uutils stays installed because
# build-essential depends on it; only the symlink targets move. The nine
# uutils-only utilities without a gnu<name> counterpart keep their uutils target
# and are off the benchmark path. Installing gnu-coreutils in this late layer
# keeps the costly toolchain layers above cache-valid across rebuilds.
RUN set -eux \
    && apt-get update \
    && apt-get install -y --no-install-recommends gnu-coreutils \
    && rm -rf /var/lib/apt/lists/* \
    && for link in $(dpkg -L coreutils-from-uutils | while read -r p; do [ -L "$p" ] && echo "$p"; done); do \
         name="$(basename "$link")"; \
         if [ -x "/usr/bin/gnu$name" ]; then ln -sf "/usr/bin/gnu$name" "$link"; fi; \
       done \
    && [ "$(readlink -f /bin/echo)" = /usr/bin/gnuecho ] \
    && /bin/echo --version | grep -q 'GNU coreutils' \
    && /usr/bin/env --version | grep -q 'GNU coreutils'

# CI has no GPU; drop any hardware Vulkan ICD so GTK selects the software
# rasterizer instead of failing to initialize a real driver.
RUN if [ -d /usr/share/vulkan/icd.d ]; then \
        find /usr/share/vulkan/icd.d -type f -name '*.json' ! -name 'lvp_icd*' -delete; \
    fi

ENV RUSTUP_TOOLCHAIN=stable
ENV CARGO_INCREMENTAL=0

LABEL org.opencontainers.image.source="https://github.com/gtkx-org/gtkx"
LABEL org.opencontainers.image.description="GTKX CI Base Image with GTK4, Node.js, Rust, and testing dependencies"
