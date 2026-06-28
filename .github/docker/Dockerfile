FROM ubuntu:26.04

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

COPY 60-gtkx-noto-sans.conf /etc/fonts/conf.d/60-gtkx-noto-sans.conf
RUN fc-cache -f

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

ARG NODE24_VERSION=24.18.0
ARG NODE22_VERSION=22.23.1
RUN set -eux \
    && curl -fsSL "https://nodejs.org/dist/v${NODE24_VERSION}/node-v${NODE24_VERSION}-linux-x64.tar.xz" \
        | tar -xJ --strip-components=1 -C /usr/local \
    && mkdir -p /opt/node22 \
    && curl -fsSL "https://nodejs.org/dist/v${NODE22_VERSION}/node-v${NODE22_VERSION}-linux-x64.tar.xz" \
        | tar -xJ --strip-components=1 -C /opt/node22 \
    && node --version | grep -q "v${NODE24_VERSION}" \
    && /opt/node22/bin/node --version | grep -q "v${NODE22_VERSION}"

RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@latest --activate

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH="/usr/local/cargo/bin:${PATH}"

ENV CARGO_NET_RETRY=10
ENV RUSTUP_MAX_RETRIES=10
ENV CARGO_HTTP_MULTIPLEXING=false

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --component clippy --component rustfmt --component llvm-tools-preview --default-toolchain stable \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN rustup toolchain install nightly --profile minimal --component llvm-tools-preview --component rust-src --component miri \
    && chmod -R a+rwX "$RUSTUP_HOME" "$CARGO_HOME"

RUN cargo install cargo-llvm-cov --locked \
    && chmod -R a+rwX "$CARGO_HOME"

RUN if [ -d /usr/share/vulkan/icd.d ]; then \
        find /usr/share/vulkan/icd.d -type f -name '*.json' ! -name 'lvp_icd*' -delete; \
    fi

ENV RUSTUP_TOOLCHAIN=stable
ENV CARGO_INCREMENTAL=0

LABEL org.opencontainers.image.source="https://github.com/gtkx-org/gtkx"
LABEL org.opencontainers.image.description="GTKX CI Base Image with GTK4, Node.js, Rust, and testing dependencies"
