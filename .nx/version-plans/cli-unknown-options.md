---
__default__: major
---

Every `gtkx` command now rejects an option it does not define instead of ignoring it, naming the option, suggesting the closest one for a typo and listing the options the command takes. `gtkx deploy --targets=deb` no longer writes the default Flatpak manifest, `gtkx build --outt dist-x` no longer takes `dist-x` as the entry, and `gtkx dev --headles` no longer opens the app on the real display. This is a breaking change for scripts that pass options GTKX never read: remove them, or put options meant for the application after `--`, as in `gtkx dev -- --verbose`. An entry argument that is not a module now names the running command, so `gtkx build notes.txt` says the command takes no application arguments rather than pointing at `gtkx dev`.
