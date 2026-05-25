import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { useLayoutEffect } from "react";

/**
 * Registers a raw CSS string with the default display via a `Gtk.CssProvider`.
 *
 * Mirrors the `gtk_css_provider_load_from_resource` + `gtk_style_context_add_provider_for_display`
 * pattern used by the official `gtk-demo` C demos that ship an external `.css`
 * resource alongside the demo. Pair with `import css from "./demo.css?raw"` so
 * the styles never drift from their canonical reference file.
 *
 * @param css - Raw CSS text (typically a `?raw` import of a `.css` resource).
 * @param priority - Provider priority; defaults to `STYLE_PROVIDER_PRIORITY_USER` (800)
 *   to match the GTK reference. Pass `Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION` (600)
 *   for demos that the C reference adds at application priority.
 */
export function useCssResource(css: string, priority: number = Gtk.STYLE_PROVIDER_PRIORITY_USER): void {
    useLayoutEffect(() => {
        const display = Gdk.DisplayManager.get().getDefaultDisplay();
        if (!display) return;

        const provider = new Gtk.CssProvider();
        provider.loadFromString(css);
        Gtk.StyleContext.addProviderForDisplay(display, provider, priority);

        return () => {
            Gtk.StyleContext.removeProviderForDisplay(display, provider);
        };
    }, [css, priority]);
}
