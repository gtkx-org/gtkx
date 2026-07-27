import * as Gtk from "@gtkx/gi/gtk";

class CssProviderFallback extends Gtk.CssProvider {
    override loadFromString(css: string): void {
        this.loadFromData(css, Buffer.byteLength(css));
    }
}

if (process.env.GTKX_GIR_PATH) {
    const fallback = Object.getOwnPropertyDescriptor(CssProviderFallback.prototype, "loadFromString");

    if (fallback) {
        Object.defineProperty(Gtk.CssProvider.prototype, "loadFromString", fallback);
    }
}
