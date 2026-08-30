import * as GLib from "@gtkx/gi/glib";
import { keepAlive } from "@gtkx/native";

const seen = { hasFired: false };

GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 200, () => {
    seen.hasFired = true;
    keepAlive(false);

    return GLib.SOURCE_REMOVE;
});

keepAlive(process.argv[2] === "held");

process.on("exit", () => {
    process.exitCode = seen.hasFired ? 0 : 7;
});
