#!/usr/bin/env bash
# Builds the GTK 4.22.4 runtime stack from source into $PREFIX on Ubuntu 22.04
# (jammy) ARM64, for the CodSpeed macro-runner Walltime bench job. Jammy ships
# GTK 4.6; the bindings target 4.22.4, so the stack the benches exercise at
# runtime (and whose .gir codegen reads) must be built here. The @gtkx/native
# addon itself builds against jammy's glib, so this only provides the runtime
# GTK + its introspection data.
#
# Idempotent: a content sentinel ($PREFIX/.stack-hash == STACK_VERSION) makes a
# warm cache a no-op past the apt runtime prerequisites. The whole pinned set is
# embedded here so the CI cache key (hashFiles of this file) rotates on any bump.
set -euo pipefail

PREFIX="${PREFIX:-/opt/gtkstack}"
TRIPLET="aarch64-linux-gnu"
STACK_VERSION="gtk-4.22.4-1"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log() { printf '\n\033[1;36m[build-gtk-stack] %s\033[0m\n' "$*"; }

# Runtime + build system dependencies reused from jammy apt (leaf libs whose
# jammy versions are new enough and ABI-forward-compatible with the from-source
# glib). Always run: the macro runner is ephemeral, so the cache only restores
# $PREFIX and /usr/local, not these system packages.
log "apt prerequisites"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
    build-essential pkg-config flex bison python3 python3-pip gettext \
    desktop-file-utils libffi-dev zlib1g-dev libpng-dev libjpeg-turbo8-dev \
    libtiff-dev libpcre2-dev libmount-dev libselinux1-dev libexpat1-dev \
    libxml2-dev libpixman-1-dev libfribidi-dev libxkbcommon-dev libepoxy-dev \
    libdrm-dev libegl1-mesa-dev libgl1-mesa-dev libgles2-mesa-dev \
    libgl1-mesa-dri libgles2 libxrandr-dev libx11-dev libinput-dev \
    adwaita-icon-theme gsettings-desktop-schemas shared-mime-info \
    hicolor-icon-theme librsvg2-common fontconfig fonts-noto-core \
    fonts-dejavu-core gvfs dbus curl ca-certificates

# CI has no GPU: drop hardware Vulkan ICDs so GTK selects llvmpipe.
if [ -d /usr/share/vulkan/icd.d ]; then
    find /usr/share/vulkan/icd.d -type f -name '*.json' ! -name 'lvp_icd*' -delete || true
fi

# Environment for the from-source builds AND for g-ir-scanner, which dlopens the
# freshly built libraries during introspection — LD_LIBRARY_PATH must point at
# $PREFIX before any introspected component is configured, or it silently emits
# no .gir and codegen later fails to find it.
export PATH="$PREFIX/bin:$PATH"
export PKG_CONFIG_PATH="$PREFIX/lib/$TRIPLET/pkgconfig:$PREFIX/lib/pkgconfig:$PREFIX/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
export LD_LIBRARY_PATH="$PREFIX/lib/$TRIPLET:$PREFIX/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GI_TYPELIB_PATH="$PREFIX/lib/$TRIPLET/girepository-1.0:$PREFIX/lib/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
export XDG_DATA_DIRS="$PREFIX/share:/usr/share:/usr/local/share"

if [ -f "$PREFIX/.stack-hash" ] && [ "$(cat "$PREFIX/.stack-hash")" = "$STACK_VERSION" ]; then
    log "warm cache ($STACK_VERSION); refreshing gdk-pixbuf loaders and exiting"
    "$PREFIX/bin/gdk-pixbuf-query-loaders" --update-cache || true
    exit 0
fi

log "cold build of $STACK_VERSION into $PREFIX"
python3 -m pip install --upgrade pip
python3 -m pip install 'meson>=1.4' ninja

# Download + extract a release tarball into a fresh source dir (echoed name).
fetch() {
    local url="$1" name
    name="$(basename "$url")"
    curl -fsSL -o "$WORK/$name" "$url"
    local dir="$WORK/src-${name%.tar.*}"
    mkdir -p "$dir"
    tar -xf "$WORK/$name" --strip-components=1 -C "$dir"
    echo "$dir"
}

# meson build a component into $PREFIX. Args: <url> <meson flags...>
build_meson() {
    local url="$1"; shift
    local dir; dir="$(fetch "$url")"
    log "building $(basename "$dir")"
    meson setup "$dir/build" "$dir" --prefix="$PREFIX" --libdir="lib/$TRIPLET" \
        --buildtype=release "$@"
    ninja -C "$dir/build" install
}

build_meson "https://gitlab.freedesktop.org/wayland/wayland/-/releases/1.25.0/downloads/wayland-1.25.0.tar.xz" \
    -Ddocumentation=false -Dtests=false -Ddtd_validation=false
build_meson "https://gitlab.freedesktop.org/wayland/wayland-protocols/-/releases/1.49/downloads/wayland-protocols-1.49.tar.xz" \
    -Dtests=false
build_meson "https://download.savannah.gnu.org/releases/freetype/freetype-2.14.3.tar.xz" \
    -Dharfbuzz=disabled -Dbrotli=disabled
build_meson "https://gitlab.freedesktop.org/fontconfig/fontconfig/-/archive/2.18.1/fontconfig-2.18.1.tar.gz" \
    -Ddoc=disabled -Dtests=disabled -Dnls=disabled
build_meson "https://download.gnome.org/sources/glib/2.88/glib-2.88.1.tar.xz" \
    -Dintrospection=enabled -Dman-pages=disabled -Ddocumentation=false -Dtests=false \
    -Dnls=disabled -Dsysprof=disabled
build_meson "https://download.gnome.org/sources/gobject-introspection/1.86/gobject-introspection-1.86.0.tar.xz" \
    -Dbuild_introspection_data=true -Ddoctool=disabled -Dtests=false -Dgtk_doc=false
build_meson "https://cairographics.org/releases/cairo-1.18.4.tar.xz" \
    -Dtests=disabled -Dxlib=disabled -Dxcb=disabled -Dglib=enabled \
    -Dfontconfig=enabled -Dfreetype=enabled -Dpng=enabled
build_meson "https://github.com/harfbuzz/harfbuzz/releases/download/14.2.1/harfbuzz-14.2.1.tar.xz" \
    -Dintrospection=enabled -Dtests=disabled -Ddocs=disabled -Dfreetype=enabled \
    -Dglib=enabled -Dgobject=enabled -Dcairo=enabled -Dgraphite2=disabled -Dicu=disabled
build_meson "https://github.com/ebassi/graphene/releases/download/1.10.8/graphene-1.10.8.tar.xz" \
    -Dintrospection=enabled -Dtests=false -Dgtk_doc=false -Dgobject_types=true -Darm_neon=true
build_meson "https://download.gnome.org/sources/pango/1.57/pango-1.57.1.tar.xz" \
    -Dintrospection=enabled -Dbuild-testsuite=false -Dbuild-examples=false \
    -Dgtk_doc=false -Dfontconfig=enabled -Dfreetype=enabled -Dcairo=enabled \
    -Dxft=disabled -Dlibthai=disabled
build_meson "https://download.gnome.org/sources/gdk-pixbuf/2.44/gdk-pixbuf-2.44.6.tar.xz" \
    -Dintrospection=enabled -Dman=false -Dtests=false -Dinstalled_tests=false \
    -Dgtk_doc=false -Dpng=enabled -Dbuiltin_loaders=png -Dothers=enabled \
    -Dtiff=disabled -Djpeg=disabled -Dglycin=disabled
build_meson "https://download.gnome.org/sources/gtk/4.22/gtk-4.22.4.tar.xz" \
    -Dintrospection=enabled -Dwayland-backend=true -Dx11-backend=false \
    -Dbroadway-backend=false -Dwin32-backend=false -Dmedia-gstreamer=disabled \
    -Dprint-cups=disabled -Dvulkan=disabled -Dcloudproviders=disabled \
    -Dsysprof=disabled -Dcolord=disabled -Dbuild-demos=false \
    -Dbuild-testsuite=false -Dbuild-tests=false -Dbuild-examples=false \
    -Ddocumentation=false -Dman-pages=false
build_meson "https://download.gnome.org/sources/libadwaita/1.8/libadwaita-1.8.6.tar.xz" \
    -Dintrospection=enabled -Dtests=false -Dexamples=false -Dvapi=false -Ddocumentation=false
build_meson "https://download.gnome.org/sources/gtksourceview/5.18/gtksourceview-5.18.0.tar.xz" \
    -Dintrospection=enabled -Dbuild-testsuite=false -Ddocumentation=false \
    -Dinstall-tests=false -Dvapi=false -Dsysprof=false

# Headless harness: weston 15 (jammy's is 9; the suite targets 15) built against
# the from-source wayland into /usr/local so it shadows any apt weston, and
# xwayland-run (provides `wlheadless-run`), a pure-Python tool absent from jammy.
log "building weston 15.0.1"
# weston's build deps come via `apt-get build-dep`, which needs source repos;
# jammy CI images ship them disabled, so mirror the ubuntu deb lines to deb-src.
grep -hE '^deb .*ubuntu' /etc/apt/sources.list /etc/apt/sources.list.d/*.list 2>/dev/null \
    | sed 's/^deb /deb-src /' > /etc/apt/sources.list.d/gtkx-debsrc.list || true
apt-get update || true
apt-get build-dep -y weston
WESTON="$(fetch https://gitlab.freedesktop.org/wayland/weston/-/releases/15.0.1/downloads/weston-15.0.1.tar.xz)"
meson setup "$WESTON/build" "$WESTON" --prefix=/usr/local --buildtype=release \
    -Dbackend-headless=true -Dbackend-default=headless \
    -Dbackend-drm=false -Dbackend-pipewire=false -Dbackend-rdp=false \
    -Dbackend-vnc=false -Dbackend-wayland=false -Dbackend-x11=false \
    -Drenderer-gl=true -Drenderer-vulkan=false \
    -Dxwayland=false -Dsystemd=false -Dremoting=false -Dpipewire=false \
    -Dshell-desktop=true -Dshell-ivi=false -Dshell-kiosk=false -Dshell-lua=false \
    -Dcolor-management-lcms=false -Dimage-jpeg=false -Dimage-webp=false \
    -Ddemo-clients=false -Dresize-pool=false -Dwcap-decode=false \
    -Dtests=false -Dtest-junit-xml=false
ninja -C "$WESTON/build" install
ldconfig
weston --version | grep -q "weston 15.0.1"

log "installing xwayland-run (wlheadless-run)"
python3 -m pip install 'xwayland-run @ git+https://gitlab.freedesktop.org/ofourdan/xwayland-run.git@0.0.6'
command -v wlheadless-run

"$PREFIX/bin/gdk-pixbuf-query-loaders" --update-cache
echo "$STACK_VERSION" > "$PREFIX/.stack-hash"
log "done: $STACK_VERSION"
