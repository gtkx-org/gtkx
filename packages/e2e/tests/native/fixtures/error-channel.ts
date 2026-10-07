import * as GLib from "@gtkx/gi/glib";

const fields = new GLib.Variant("a{sv}", { MESSAGE: new GLib.Variant("s", "Authored diagnostic") });
const level =
    process.argv[2] === "critical" ? GLib.LogLevelFlags.LEVEL_CRITICAL : GLib.LogLevelFlags.LEVEL_WARNING;

if (process.argv[3] === "observed") {
    process.once("uncaughtException", () => {
        process.exitCode = 42;
    });
}

GLib.logVariant("gtkx-error-channel", level, fields);
process.exitCode = 0;
