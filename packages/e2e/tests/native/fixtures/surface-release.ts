import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";

const GC_ROUNDS = 30;
const GC_PAUSE_MS = 10;

const collectGarbage = () => {
    if (!globalThis.gc) {
        throw new Error("global.gc is not available. Run the fixture with --expose-gc.");
    }

    globalThis.gc();
};

const settle = async () => {
    for (let round = 0; round < GC_ROUNDS; round += 1) {
        collectGarbage();
        await new Promise((resolve) => setTimeout(resolve, GC_PAUSE_MS));
    }
};

const getDefaultDisplay = () => {
    const display = Gdk.Display.getDefault();

    if (display === null) {
        throw new Error("Expected a default GdkDisplay");
    }

    return display;
};

const presentWindow = () => {
    const window = new Gtk.Window({ title: "surface-release", defaultWidth: 160, defaultHeight: 120 });
    window.present();

    return window;
};

const getSurface = (window: Gtk.Window): Gdk.Surface => {
    const surface = window.getSurface();

    if (surface === null) {
        throw new Error("Expected the presented window to have a surface");
    }

    return surface;
};

const dropUndestroyed = async () => {
    Gdk.Surface.newToplevel(getDefaultDisplay());
    await settle();
};

const dropPredestroyed = async () => {
    const window = presentWindow();
    const surface = getSurface(window);
    window.destroy();
    process.stdout.write(`PREDESTROYED ${String(surface.isDestroyed())}\n`);
    await settle();
};

const dropHeld = async () => {
    const window = presentWindow();
    getSurface(window);
    await settle();
    process.stdout.write(`HELD ${String(getSurface(window).isDestroyed())}\n`);
    window.destroy();
};

const run = async (scenario: string | undefined): Promise<void> => {
    Gtk.init();

    if (scenario === "predestroyed") {
        await dropPredestroyed();
    } else if (scenario === "held") {
        await dropHeld();
    } else {
        await dropUndestroyed();
    }

    process.stdout.write("SETTLED\n");
};

await run(process.argv[2]);
