import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";

type ProbedStyle = {
    color: number[];
    alpha: number;
    minWidth: number;
};

type ProbeOptions = {
    classNames: string[];
    stateFlags?: Gtk.StateFlags;
};

const SETTLE_ROUNDS = 50;

const settle = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
        queueMicrotask(resolve);
    });

    const context = GLib.MainContext.default();

    for (let round = 0; round < SETTLE_ROUNDS; round++) {
        while (context.pending()) {
            context.iteration(false);
        }
    }
};

const readStyle = (label: Gtk.Label): ProbedStyle => {
    const color = label.getColor();
    const [minWidth] = label.measure(Gtk.Orientation.HORIZONTAL, -1);

    return { color: [color.red, color.green, color.blue], alpha: color.alpha, minWidth };
};

const probeStyle = async (options: ProbeOptions): Promise<ProbedStyle> => {
    const label = new Gtk.Label({ label: "probe" });
    const window = new Gtk.Window();
    window.setChild(label);
    label.setCssClasses(options.classNames);
    window.present();

    if (options.stateFlags !== undefined) {
        label.setStateFlags(options.stateFlags, false);
    }

    await settle();
    const style = readStyle(label);
    window.destroy();

    return style;
};

const probeColor = async (classNames: string[]): Promise<number[]> => {
    const style = await probeStyle({ classNames });

    return style.color;
};

const probeMinWidth = async (classNames: string[]): Promise<number> => {
    const style = await probeStyle({ classNames });

    return style.minWidth;
};

export { probeColor, probeMinWidth, probeStyle };
