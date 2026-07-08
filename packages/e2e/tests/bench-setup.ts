import * as Gtk from "@gtkx/gi/gtk";

/**
 * The benchmark job generates bindings from a newer GIR (so the source's 4.12+
 * API surface type-checks) but runs against the macro runner's older GTK
 * runtime, where `gtk_css_provider_load_from_string` does not exist. Route
 * {@link Gtk.CssProvider.loadFromString} to the older `load_from_data` so
 * styling still applies. Gated on `GTKX_GIR_PATH`, which is only set for the
 * benchmark run, so the test suite (real GTK) keeps the native method.
 */
if (process.env.GTKX_GIR_PATH) {
    Gtk.CssProvider.prototype.loadFromString = function loadFromString(this: Gtk.CssProvider, css: string): void {
        this.loadFromData(css, Buffer.byteLength(css));
    };
}
