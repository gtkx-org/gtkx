import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

const SETTLE_MS = 3000;
const BENIGN_CSS = "gtkx-error-channel-probe { not-a-property: nonsense }";

const provokeCritical = () => {
    Gtk.init();
    const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0);
    const stranger = Gtk.Label.new("a widget the box never adopted");
    box.remove(stranger);
};

const provokePanic = () => {
    const task = Gio.Task.new(new GObject.Object({}), null, null);

    task.runInThread((worker) => {
        worker.returnBoolean(true);
    });
};

const provokeNothing = () => {
    Gtk.init();
    const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0);
    const label = Gtk.Label.new("a widget the box adopted");
    box.append(label);
    box.remove(label);
    Gtk.CssProvider.new().loadFromString(BENIGN_CSS);
};

const provoke = (mode: string | undefined): void => {
    if (mode === "critical") {
        provokeCritical();
    } else if (mode === "panic") {
        provokePanic();
    } else {
        provokeNothing();
    }
};

const settle = setTimeout(() => {
    process.stdout.write("SURVIVED\n");
}, SETTLE_MS);

if (process.argv[3] === "observed") {
    process.on("uncaughtException", (error) => {
        clearTimeout(settle);
        process.stdout.write(`OBSERVED ${error.message}\n`);
    });
}

provoke(process.argv[2]);
