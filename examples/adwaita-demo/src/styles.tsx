import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkCssProvider } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { useEffect, useState } from "react";
import css from "./styles/demo.css?raw";

const DemoStyles = () => {
    const [provider, setProvider] = useState<Gtk.CssProvider | null>(null);
    useEffect(() => {
        const display = Gdk.Display.getDefault();
        if (!display || !provider) {
            return;
        }
        provider.loadFromString(css);
        Gtk.StyleContext.addProviderForDisplay(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        return () => Gtk.StyleContext.removeProviderForDisplay(display, provider);
    }, [provider]);
    return createPortal(<GtkCssProvider ref={setProvider} />, rootElement);
};

export { DemoStyles };
