FROM node:26.8.2-bookworm-slim AS node
FROM golang:1.26.6-bookworm AS go
FROM docker:28.3.1-cli AS docker
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
        libgstreamer1.0-dev libgirepository1.0-dev libostree-dev gobject-introspection \
        gvfs libgles2 libgl1-mesa-dri mesa-vulkan-drivers sway weston xwayland-run dbus \
        libasan8 adwaita-icon-theme gsettings-desktop-schemas shared-mime-info \
        hicolor-icon-theme librsvg2-common desktop-file-utils espeak-ng \
        flatpak-builder appstream dpkg-dev rpm pipx fontconfig fonts-noto-core fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /opt/gtkx-toolchains && \
    gst_gir="/usr/lib/$(dpkg-architecture -qDEB_HOST_MULTIARCH)/gir-1.0/Gst-1.0.gir" && \
    if [ -f "$gst_gir" ]; then ln -sf "$gst_gir" /usr/share/gir-1.0/Gst-1.0.gir; fi && \
    for driver in /usr/share/vulkan/icd.d/lvp_icd*.json; do \
        if [ -f "$driver" ]; then ln -s "$driver" "$VK_DRIVER_FILES"; break; fi; \
    done && \
    test -f "$VK_DRIVER_FILES"

COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker /usr/local/libexec/docker
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
COPY --from=go /usr/local/go /usr/local/go

RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    if getent passwd ubuntu >/dev/null; then userdel --remove ubuntu; fi && \
    if getent group ubuntu >/dev/null; then groupdel ubuntu; fi && \
    groupadd --gid 10001 workflows && \
    useradd --create-home --uid 10000 --gid workflows --home-dir /home/workflows --shell /bin/bash workflows && \
    mkdir -p /home/workflows/workspace /home/workflows/.npm-global/{bin,lib} /home/workflows/.nvm && \
    chown -R 10000:10001 /home/workflows

COPY rust-toolchain.toml /opt/gtkx-toolchains/rust-toolchain.toml
COPY packages/native/tools/rust-toolchain.toml /opt/gtkx-toolchains/native/rust-toolchain.toml

USER workflows
WORKDIR /opt/gtkx-toolchains

RUN case "$(dpkg --print-architecture)" in \
        amd64) rust_target=x86_64-unknown-linux-gnu; rustup_sha=20a06e644b0d9bd2fbdbfd52d42540bdde820ea7df86e92e533c073da0cdd43c ;; \
        arm64) rust_target=aarch64-unknown-linux-gnu; rustup_sha=e3853c5a252fca15252d07cb23a1bdd9377a8c6f3efa01531109281ae47f841c ;; \
        *) exit 1 ;; \
    esac && \
    rustup_download="$(mktemp -d)" && \
    curl --fail --show-error --silent --location \
        "https://static.rust-lang.org/rustup/archive/1.28.2/$rust_target/rustup-init" \
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
    cargo install cargo-audit --version 0.22.2 --locked

WORKDIR /home/workflows

RUN pipx install 'git+https://github.com/flatpak/flatpak-builder-tools.git@de2225a6dee4818c1339b3cdbf29f90c471fcb7e#subdirectory=node' && \
    go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -version && \
    go run github.com/mikefarah/yq/v4@v4.54.1 --version

USER 0:0
COPY package.json /opt/gtkx-toolchains/package.json

RUN package_manager="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; const { packageManager } = JSON.parse(readFileSync("/opt/gtkx-toolchains/package.json", "utf8")); if (!/^pnpm@\d+\.\d+\.\d+(?:\+sha512\.[a-f0-9]+)?$/.test(packageManager)) throw new Error("Expected a pinned pnpm packageManager"); process.stdout.write(packageManager.split("+")[0]);')" && \
    npm install --global --cache /tmp/gtkx-npm-cache "$package_manager" && \
    rm -rf /tmp/gtkx-npm-cache

RUN chown -R 10000:10001 /home/workflows/.npm-global

USER workflows
WORKDIR /home/workflows/workspace
ENTRYPOINT ["/home/workflows/executor-binary/nx-cloud-workflow-executor"]
