import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

const SETTLE_MS = 3000;
const OBSERVED = "observed";
const BENIGN_CSS = "gtkx-error-channel-probe { not-a-property: nonsense }";

const provokeCritical = (): void => {
    Gtk.init();
    const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0);
    const stranger = Gtk.Label.new("a widget the box never adopted");
    box.remove(stranger);
};

const provokePanic = (): void => {
    const task = Gio.Task.new(new GObject.Object(), null, null);

    task.runInThread((worker) => {
        worker.returnBoolean(true);
    });
};

const provokeNothing = (): void => {
    Gtk.init();
    const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0);
    const label = Gtk.Label.new("a widget the box adopted");
    box.append(label);
    box.remove(label);
    Gtk.CssProvider.new().loadFromString(BENIGN_CSS);
};

const provoke = (provocation: string | undefined): void => {
    if (provocation === "critical") {
        provokeCritical();
    } else if (provocation === "panic") {
        provokePanic();
    } else {
        provokeNothing();
    }
};

const observeUncaught = (settle: NodeJS.Timeout): void => {
    process.on("uncaughtException", (error) => {
        clearTimeout(settle);
        process.stdout.write(`OBSERVED ${error.message}\n`);
    });
};

const runFixture = (provocation: string | undefined, observation: string | undefined): void => {
    const settle = setTimeout(() => {
        process.stdout.write("SURVIVED\n");
    }, SETTLE_MS);

    if (observation === OBSERVED) {
        observeUncaught(settle);
    }

    provoke(provocation);
};

runFixture(process.argv[2], process.argv[3]);
