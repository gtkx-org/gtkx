import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const isCancellation = (error: unknown): boolean =>
    (error instanceof Gtk.DialogError &&
        (error.code === Gtk.DialogError.DISMISSED || error.code === Gtk.DialogError.CANCELLED)) ||
        (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED);

export { isCancellation };
