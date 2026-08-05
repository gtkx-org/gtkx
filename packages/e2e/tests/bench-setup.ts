import * as Gtk from "@gtkx/gi/gtk";

class CssProviderFallback extends Gtk.CssProvider {
    override loadFromString(css: string): void {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        this.loadFromData(css, Buffer.byteLength(css));
    }
}

if (process.env.GTKX_GIR_PATH) {
    const fallback = Object.getOwnPropertyDescriptor(CssProviderFallback.prototype, "loadFromString");

    if (fallback) {
        Object.defineProperty(Gtk.CssProvider.prototype, "loadFromString", fallback);
    }
}
