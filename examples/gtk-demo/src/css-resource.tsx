import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkCssProvider } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { type ReactNode, useLayoutEffect, useState } from "react";

type CssResourceProps = {
    css: string;
    priority?: number;
};

function CssResource({ css, priority = Gtk.STYLE_PROVIDER_PRIORITY_USER }: CssResourceProps): ReactNode {
    const [provider, setProvider] = useState<Gtk.CssProvider | null>(null);

    useLayoutEffect(() => {
        if (provider === null) {
            return;
        }

        const display = Gdk.DisplayManager.get().getDefaultDisplay();

        if (!display) {
            return;
        }

        provider.loadFromString(css);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        Gtk.StyleContext.addProviderForDisplay(display, provider, priority);

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            Gtk.StyleContext.removeProviderForDisplay(display, provider);
        };
    }, [css, priority, provider]);

    return createPortal(<GtkCssProvider ref={setProvider} />, rootElement);
}

export { CssResource };
