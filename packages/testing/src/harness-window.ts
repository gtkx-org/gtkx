import * as Gtk from "@gtkx/gi/gtk";
import { mappedToplevels } from "./window-state.js";

const HARNESS_WINDOW_WIDTH = 800;
const HARNESS_WINDOW_HEIGHT = 600;
const TEXT_END_POSITION = -1;

const createHarnessWindow = (): Gtk.Window =>
    new Gtk.Window({ defaultWidth: HARNESS_WINDOW_WIDTH, defaultHeight: HARNESS_WINDOW_HEIGHT });

const presentWithCaretAtEnd = (window: Gtk.Window): void => {
    window.present();
    const focus = window.getFocus();

    if (focus instanceof Gtk.Text) {
        focus.setPosition(TEXT_END_POSITION);
    }
};

const transientsOf = (window: Gtk.Window): Gtk.Window[] =>
    mappedToplevels()
        .filter((toplevel) => toplevel.getTransientFor() === window)
        .toReversed();

/**
 * Presents the harness window after the windows its tree already opened over it, which are hidden
 * first and returned oldest first, because a compositor activates a newly mapped window but not one
 * that is presented again.
 */
const presentHarnessWindow = (window: Gtk.Window | null): Gtk.Window[] => {
    if (!window) {
        return [];
    }

    const transients = transientsOf(window);

    for (const transient of transients) {
        transient.setVisible(false);
    }

    presentWithCaretAtEnd(window);

    return transients;
};

const presentHarnessTransients = (transients: Gtk.Window[]): Gtk.Window | null => {
    for (const transient of transients) {
        presentWithCaretAtEnd(transient);
    }

    return transients.at(-1) ?? null;
};

export { createHarnessWindow, presentHarnessTransients, presentHarnessWindow };
