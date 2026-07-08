import * as Gtk from "@gtkx/gi/gtk";

if (process.env.GTKX_GIR_PATH) {
    Gtk.CssProvider.prototype.loadFromString = function loadFromString(this: Gtk.CssProvider, css: string): void {
        this.loadFromData(css, Buffer.byteLength(css));
    };
}
