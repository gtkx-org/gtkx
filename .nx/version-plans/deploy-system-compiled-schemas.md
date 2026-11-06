---
__default__: patch
---

Debian, RPM and Flatpak packages built by `gtkx deploy` no longer ship the build's private `gschemas.compiled`. They already install the application's GSettings schemas into the system schema directory, which the distribution or the Flatpak manifest compiles, but the private copy was read first, so vendor `.gschema.override` files never changed an installed app's defaults. The AppImage and `node dist/bundle.mjs` keep reading the compiled schemas beside the bundle.
