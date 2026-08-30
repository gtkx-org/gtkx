import * as GLib from "@gtkx/gi/glib";
import "@gtkx/native";

const DISTANT_MS = 600_000;

GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, DISTANT_MS, () => GLib.SOURCE_REMOVE);
GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => GLib.SOURCE_REMOVE);

process.on("exit", () => {
    process.stdout.write("EXITED\n");
});

process.stdout.write("SOURCES\n");
