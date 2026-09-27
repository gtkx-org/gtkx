# syntax=docker/dockerfile:1
FROM ubuntu:26.04@sha256:da6fc2be547864451aa253836dd926da33623312df4a9a243e35dc877c378a78

ARG DEBIAN_FRONTEND=noninteractive

ENV LANG=C.UTF-8

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
        meson \
        ninja-build \
        gettext \
        locales-all \
        pkg-config \
        libgtk-4-dev \
        libadwaita-1-dev \
        libgtksourceview-5-dev \
        libwebkitgtk-6.0-dev \
        libgstreamer1.0-dev \
        libgirepository1.0-dev \
        libostree-dev \
        gobject-introspection \
        gvfs \
        libgles2 \
        libgl1-mesa-dri \
        sway \
        weston \
        xwayland-run \
        dbus \
        git \
        libasan8 \
        adwaita-icon-theme \
        gsettings-desktop-schemas \
        shared-mime-info \
        hicolor-icon-theme \
        librsvg2-common \
        desktop-file-utils \
        espeak-ng \
        flatpak-builder \
        appstream \
        dpkg-dev \
        rpm \
        binutils \
        file \
        pipx \
        xz-utils \
        fontconfig \
        fonts-noto-core \
        fonts-dejavu-core \
        libgtk-4-1-dbgsym \
        libadwaita-1-0-dbgsym \
        libglib2.0-0t64-dbgsym \
    && ln -s "/usr/lib/$(dpkg-architecture -qDEB_HOST_MULTIARCH)/gir-1.0/Gst-1.0.gir" \
        /usr/share/gir-1.0/Gst-1.0.gir \
    && rm -rf /var/lib/apt/lists/*

ARG FLATPAK_BUILDER_TOOLS=de2225a6dee4818c1339b3cdbf29f90c471fcb7e
ENV PIPX_HOME=/opt/pipx
ENV PIPX_BIN_DIR=/usr/local/bin
RUN pipx install \
        "git+https://github.com/flatpak/flatpak-builder-tools.git@${FLATPAK_BUILDER_TOOLS}#subdirectory=node" \
    && flatpak-node-generator --help | grep -q -- --pnpm-store-version \
    && chmod -R a+rX /opt/pipx

COPY 60-gtkx-noto-sans.conf /etc/fonts/conf.d/60-gtkx-noto-sans.conf
RUN fc-cache -f

ARG NODE26_VERSION=26.8.2
ARG TARGETARCH
RUN set -eux \
    && case "${TARGETARCH}" in \
        amd64) node_arch=x64; node_sha=40e1d3225c1c9ae9a2671c98ecb9857e4d5555026394f348645676798840d5c5 ;; \
        arm64) node_arch=arm64; node_sha=81d8f0fdea9dcd3bfdcfeafc5f8359c151f097e9880b0007c0645ca670d07971 ;; \
        *) echo "unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://nodejs.org/dist/v${NODE26_VERSION}/node-v${NODE26_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz \
    && printf '%s  /tmp/node.tar.xz\n' "$node_sha" | sha256sum -c - \
    && tar -xJ --strip-components=1 -C /usr/local -f /tmp/node.tar.xz \
    && rm /tmp/node.tar.xz \
    && node --version | grep -q "v${NODE26_VERSION}"

ENV COREPACK_HOME=/usr/local/share/corepack
RUN npm install -g npm@12.0.2 corepack@0.36.0 \
    && corepack enable \
    && corepack prepare pnpm@12.4.2 --activate \
    && pnpm --version \
    && chmod -R a+rwX "$COREPACK_HOME"

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH="/usr/local/cargo/bin:${PATH}"

ENV CARGO_NET_RETRY=10
ENV RUSTUP_MAX_RETRIES=10
ENV CARGO_HTTP_MULTIPLEXING=false

ARG RUST_VERSION=1.98.1
ARG RUST_NIGHTLY=nightly-2026-09-15
ARG RUSTUP_VERSION=1.29.1
RUN set -eux \
    && case "${TARGETARCH}" in \
        amd64) rustup_target=x86_64-unknown-linux-gnu; rustup_sha=dda7234360b7f578ca8b0ddcb80145646fa61a67c1720a5abc7051b35c9fcb71 ;; \
        arm64) rustup_target=aarch64-unknown-linux-gnu; rustup_sha=15f6e4ce9f583b929c996c91562bad6d4454f3281de858b02cdfdef615fac433 ;; \
        *) exit 1 ;; \
    esac \
    && curl --proto '=https' --tlsv1.2 -fsSL "https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/${rustup_target}/rustup-init" -o /tmp/rustup-init \
    && printf '%s  /tmp/rustup-init\n' "$rustup_sha" | sha256sum -c - \
    && chmod +x /tmp/rustup-init \
    && /tmp/rustup-init -y --profile minimal --component clippy --component rustfmt --default-toolchain "${RUST_VERSION}" \
    && rm /tmp/rustup-init \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN rustup toolchain install "${RUST_NIGHTLY}" --profile minimal --component rustfmt \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN if [ -d /usr/share/vulkan/icd.d ]; then \
        find /usr/share/vulkan/icd.d -type f -name '*.json' ! -name 'lvp_icd*' -delete; \
    fi

RUN mkdir -p /opt/gtkx-ci \
    && dpkg-query -W -f='${binary:Package}=${Version}\n' | sort > /opt/gtkx-ci/packages.txt \
    && node --version > /opt/gtkx-ci/node-version.txt \
    && rustc --version --verbose > /opt/gtkx-ci/rust-version.txt

ENV CARGO_INCREMENTAL=0

LABEL org.opencontainers.image.source="https://github.com/gtkx-org/gtkx"
LABEL org.opencontainers.image.description="GTKX CI Base Image with Adwaita, GTK4, Node.js, Rust, and testing dependencies"
