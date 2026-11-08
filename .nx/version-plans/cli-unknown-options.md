---
__default__: major
---

Every `gtkx` command now rejects options it does not define, suggesting the closest one, instead of ignoring them, so `gtkx deploy --targets=deb` no longer writes the default Flatpak manifest. Commands that start no application also reject arguments after `--`, and `gtkx dev`, `build` and `deploy` reject an entry that is not a JavaScript or TypeScript module. Remove options GTKX never read, and pass application options after `--`, as in `gtkx dev -- --verbose`. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes).
