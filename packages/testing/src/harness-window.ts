import * as Gtk from "@gtkx/gi/gtk";

const HARNESS_WINDOW_WIDTH = 800;
const HARNESS_WINDOW_HEIGHT = 600;

const createHarnessWindow = (): Gtk.Window =>
    new Gtk.Window({ defaultWidth: HARNESS_WINDOW_WIDTH, defaultHeight: HARNESS_WINDOW_HEIGHT });

export { createHarnessWindow };
