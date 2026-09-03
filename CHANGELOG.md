# Changelog

## Unreleased

Generated bindings now follow GIR and JavaScript member precedence. GIR `shadows` metadata selects the canonical name, so use `Gio.Subprocess.new(argv, flags)` instead of the previously exposed inherited `newv` member. More-specific class and interface methods now keep their natural camelCase names, such as `socket.connect(...)` and `device.getProperty(...)`.

When one of those methods owns a usual signal-helper name, use `GObject.signalConnect`, `GObject.signalDisconnect`, or `GObject.signalEmit` to work with signals on that object.

`GObject.getObjectProperty` and `GObject.setObjectProperty` now provide the same collision-safe access for properties. Their descriptor-free forms infer readable and mutable property names and values from the generated type.

### Migrating from older GTKX releases

An interrupted headless run from an older GTKX release may have left a private Sway compositor and D-Bus daemon running. Inspect processes owned by your user before removing anything:

```sh
ps -u "$(id -u)" -o pid=,ppid=,pgid=,sid=,args= | grep -E '/tmp/gtkx-xdg-[[:alnum:]]{6}/(sway|session)\.conf'
```

Only treat a matching process as a GTKX orphan when its command is exactly `sway -c .../sway.conf` or `dbus-daemon --config-file=.../session.conf`, its PID equals its PGID and SID, and no active test or development process owns its `/tmp/gtkx-xdg-*` directory. The parent should be PID 1 or your user `systemd` reaper. A directory may have an orphaned Sway process, D-Bus daemon, or both.

Set `runtime_dir` to one exact candidate path from the process listing, then inspect it:

```sh
stat -c '%U %a %n' -- "${runtime_dir}"
sed -n '1,20p' -- "${runtime_dir}/sway.conf" "${runtime_dir}/session.conf"
```

It must be owned by your user with mode `700`. The Sway config must contain the GTKX headless output and border rules, and the session-bus config must listen on `unix:path=${runtime_dir}/bus`. If every check matches, set `orphan_pgid` to one verified PGID and `runtime_dir` to its exact inspected path, then terminate that group:

```sh
kill -- "-${orphan_pgid}"
```

Repeat that exact-PGID command for any other verified orphan using the same directory. After no process from the listing references it, remove only that exact directory:

```sh
rm -r -- "${runtime_dir}"
```

Do not use a wildcard when removing runtime directories. Current GTKX releases clean up their headless process groups and runtime directory automatically.
