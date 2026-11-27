FROM node:26.13.1-bookworm-slim AS node
FROM golang:1.27.4-bookworm AS go
FROM docker:29.10.1-cli AS docker
FROM ubuntu:26.04

LABEL org.opencontainers.image.source="https://github.com/gtkx-org/gtkx"

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

ENV HOME=/home/workflows \
    CARGO_HOME=/home/workflows/.cargo \
    RUSTUP_HOME=/home/workflows/.rustup \
    GOPATH=/home/workflows/go \
    NPM_CONFIG_PREFIX=/home/workflows/.npm-global \
    GOTOOLCHAIN=local \
    PATH=/home/workflows/.npm-global/bin:/home/workflows/.cargo/bin:/home/workflows/.local/bin:/home/workflows/go/bin:/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    CARGO_INCREMENTAL=0 \
    GIT_CONFIG_COUNT=1 \
    GIT_CONFIG_KEY_0=init.defaultBranch \
    GIT_CONFIG_VALUE_0=main \
    VK_DRIVER_FILES=/opt/gtkx-toolchains/lvp_icd.json

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl git openssh-client procps tar unzip util-linux xz-utils \
        build-essential meson ninja-build gettext locales-all pkg-config shellcheck file \
        libgtk-4-dev libadwaita-1-dev libgtksourceview-5-dev libwebkitgtk-6.0-dev \
        libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev libgirepository1.0-dev gir1.2-girepository-3.0-dev \
        libjson-glib-dev libostree-dev gobject-introspection \
        gvfs libgles2 libgl1-mesa-dri mesa-vulkan-drivers sway dbus \
        libasan8 adwaita-icon-theme gsettings-desktop-schemas shared-mime-info \
        hicolor-icon-theme librsvg2-common desktop-file-utils espeak-ng \
        flatpak-builder appstream dpkg-dev rpm pipx fontconfig fonts-noto-core fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /opt/gtkx-toolchains && \
    for driver in /usr/share/vulkan/icd.d/lvp_icd*.json; do \
        if [ -f "$driver" ]; then ln -s "$driver" "$VK_DRIVER_FILES"; break; fi; \
    done && \
    test -f "$VK_DRIVER_FILES"

COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker /usr/local/libexec/docker
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
COPY --from=go /usr/local/go /usr/local/go

# GitHub-hosted runners own the mounted workspace as UID 1001, so the image user shares it.
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    if getent passwd ubuntu >/dev/null; then userdel --remove ubuntu; fi && \
    if getent group ubuntu >/dev/null; then groupdel ubuntu; fi && \
    groupadd --gid 1001 workflows && \
    useradd --create-home --uid 1001 --gid workflows --home-dir /home/workflows --shell /bin/bash workflows && \
    mkdir -p /home/workflows/workspace /home/workflows/.npm-global/{bin,lib} /home/workflows/.nvm && \
    chown -R workflows:workflows /home/workflows

COPY rust-toolchain.toml /opt/gtkx-toolchains/rust-toolchain.toml
COPY packages/native/tools/rust-toolchain.toml /opt/gtkx-toolchains/native/rust-toolchain.toml

USER workflows
WORKDIR /opt/gtkx-toolchains

RUN case "$(dpkg --print-architecture)" in \
        amd64) rust_target=x86_64-unknown-linux-gnu; rustup_sha=b1c8cb14e30889e7e2999e6b69e62d9e9b9ffc0f4df8180564d306d9680e6c55 ;; \
        arm64) rust_target=aarch64-unknown-linux-gnu; rustup_sha=9f608c142e0e38a78957d0661ba1dfaf0b6fb37184cfaa4b9a0aa57af6184282 ;; \
        *) exit 1 ;; \
    esac && \
    rustup_download="$(mktemp -d)" && \
    curl --fail --show-error --silent --location \
        "https://static.rust-lang.org/rustup/archive/1.29.3/$rust_target/rustup-init" \
        --output "$rustup_download/rustup-init" && \
    printf '%s  %s\n' "$rustup_sha" "$rustup_download/rustup-init" | sha256sum --check && \
    chmod +x "$rustup_download/rustup-init" && \
    "$rustup_download/rustup-init" -y --profile minimal --default-toolchain none --no-modify-path && \
    rm -rf "$rustup_download" && \
    rustup show

WORKDIR /opt/gtkx-toolchains/native
RUN rustup show

WORKDIR /opt/gtkx-toolchains
RUN rustup default "$(python3 -c 'import tomllib; print(tomllib.load(open("rust-toolchain.toml", "rb"))["toolchain"]["channel"])')" && \
    cargo install cargo-audit --version 0.23.0 --locked

WORKDIR /home/workflows

RUN pipx install 'git+https://github.com/flatpak/flatpak-builder-tools.git@9d86d336a39b9af38b86f114b6ce5820fe260f91#subdirectory=node' && \
    go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -version && \
    go run github.com/mikefarah/yq/v4@v4.54.3 --version

USER 0:0
COPY package.json /opt/gtkx-toolchains/package.json

RUN package_manager="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; const { packageManager } = JSON.parse(readFileSync("/opt/gtkx-toolchains/package.json", "utf8")); if (!/^pnpm@\d+\.\d+\.\d+(?:\+sha512\.[a-f0-9]+)?$/.test(packageManager)) throw new Error("Expected a pinned pnpm packageManager"); process.stdout.write(packageManager.split("+")[0]);')" && \
    npm install --global --cache /tmp/gtkx-npm-cache "$package_manager" && \
    rm -rf /tmp/gtkx-npm-cache

RUN chown -R workflows:workflows /home/workflows/.npm-global

USER workflows
WORKDIR /home/workflows/workspace
