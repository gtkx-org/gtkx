---
__default__: minor
---

Flatpaks built by `gtkx deploy` now target the GNOME 51 runtime (`org.gnome.Platform//51`) unless `deploy.flatpak.runtimeVersion` names another branch. GNOME 51 has been stable on Flathub since October 2026, and `flatpak-builder-lint` warned on every manifest that targeted GNOME 50; set `runtimeVersion: "50"` to keep building against the previous runtime.
