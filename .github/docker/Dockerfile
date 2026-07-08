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
        libgirepository1.0-dev \
        gobject-introspection \
        gvfs \
        libgles2 \
        libgl1-mesa-dri \
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

# ubuntu:26.04 packages weston 14, whose headless backend provides no input seat,
# so a GTK popover's autohide grab fails and the popover never maps under the
# vitest headless compositor. weston 15 adds --fake-seat (which the headless
# display setup passes), so build it from source over the packaged runtime.
ARG WESTON_VERSION=15.0.1
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        meson ninja-build hwdata wayland-protocols libwayland-bin \
        libwayland-dev libpixman-1-dev libinput-dev libxkbcommon-dev \
        libcairo2-dev libdrm-dev libudev-dev libseat-dev libdbus-1-dev \
    && curl -fsSL "https://gitlab.freedesktop.org/wayland/weston/-/releases/${WESTON_VERSION}/downloads/weston-${WESTON_VERSION}.tar.xz" \
        | tar -xJ -C /tmp \
    && meson setup /tmp/weston-${WESTON_VERSION}/build /tmp/weston-${WESTON_VERSION} \
        --prefix=/usr --buildtype=release \
        -Dbackend-default=headless -Dbackend-drm=false -Dbackend-rdp=false \
        -Dbackend-vnc=false -Dbackend-pipewire=false -Dbackend-x11=false \
        -Drenderer-gl=false -Drenderer-vulkan=false -Dxwayland=false \
        -Dremoting=false -Dpipewire=false -Dimage-jpeg=false -Dimage-webp=false \
        -Dshell-lua=false -Dshell-ivi=false -Dshell-kiosk=false \
        -Dcolor-management-lcms=false -Ddemo-clients=false \
        -Dsimple-clients=[] -Dtools=[] -Dtests=false \
    && ninja -C /tmp/weston-${WESTON_VERSION}/build install \
    && weston --version \
    && weston --help 2>&1 | grep -q -- '--fake-seat' \
    && rm -rf /tmp/weston-${WESTON_VERSION} /var/lib/apt/lists/*

COPY 60-gtkx-noto-sans.conf /etc/fonts/conf.d/60-gtkx-noto-sans.conf
RUN fc-cache -f

ARG NODE24_VERSION=24.18.0
RUN set -eux \
    && curl -fsSL "https://nodejs.org/dist/v${NODE24_VERSION}/node-v${NODE24_VERSION}-linux-x64.tar.xz" \
        | tar -xJ --strip-components=1 -C /usr/local \
    && node --version | grep -q "v${NODE24_VERSION}"

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
