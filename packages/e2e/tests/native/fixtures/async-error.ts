import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import { keepAlive } from "@gtkx/native";

const completion = { hasEntered: false };

process.on("exit", () => {
    if (!completion.hasEntered) {
        process.exitCode = 2;
    }
});

const deadline = setTimeout(() => {
    keepAlive(false);
    process.exitCode = 2;
}, 3000);

if (process.argv[2] === "observed") {
    process.on("uncaughtException", () => {
        clearTimeout(deadline);
        keepAlive(false);
        process.exitCode = 42;
    });
}

const task = Gio.Task.new(new GObject.Object({}), null, () => {
    completion.hasEntered = true;
    keepAlive(false);
    throw new Error("Callback failed");
});

keepAlive(true);
task.returnBoolean(true);
