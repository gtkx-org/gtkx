import * as Gtk from "@gtkx/gi/gtk";

const HARNESS_WINDOW_WIDTH = 800;
const HARNESS_WINDOW_HEIGHT = 600;
const TEXT_END_POSITION = -1;

const createHarnessWindow = (): Gtk.Window =>
    new Gtk.Window({ defaultWidth: HARNESS_WINDOW_WIDTH, defaultHeight: HARNESS_WINDOW_HEIGHT });

const presentHarnessWindow = (window: Gtk.Window | null): void => {
    if (!window) {
        return;
    }

    window.present();
    const focus = window.getFocus();

    if (focus instanceof Gtk.Text) {
        focus.setPosition(TEXT_END_POSITION);
    }
};

export { createHarnessWindow, presentHarnessWindow };
