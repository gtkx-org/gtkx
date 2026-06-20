import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect } from "react";

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
