import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-basics.tsx?raw";

const DEFAULT_CSS = `/* You can edit the text in this window to change the
 * appearance of this Window.
 * Be careful, if you screw it up, nothing might be visible
 * anymore. :)
 */

/* Set a very futuristic style by default */
.demo * {
  color: green;
  font-family: Monospace;
  border: 1px solid;
}

window.demo {
  background-color: white;
}

/* Make sure selections are visible */
.demo selection {
  background-color: darkGreen;
  color: black;
}
`;

const CssBasicsDemo = () => {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const providerRef = useRef<Gtk.CssProvider | null>(null);
    const displayRef = useRef<Gdk.Display | null>(null);
    const handlerIdRef = useRef<number | null>(null);

    const handleBufferChanged = useCallback((buffer: Gtk.TextBuffer) => {
        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();
        buffer.getStartIter(startIter);
        buffer.getEndIter(endIter);
        const text = buffer.getText(startIter, endIter, false);

        if (providerRef.current) {
            providerRef.current.loadFromString(text);
        }
    }, []);

    useEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;

        const provider = new Gtk.CssProvider();
        providerRef.current = provider;

        const display = Gdk.DisplayManager.get().getDefaultDisplay();
        displayRef.current = display;

        if (display) {
            Gtk.StyleContext.addProviderForDisplay(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
        }

        const buffer = textView.getBuffer();
        if (buffer) {
            buffer.setText(DEFAULT_CSS, -1);
            handleBufferChanged(buffer);
            handlerIdRef.current = buffer.connect("changed", () => handleBufferChanged(buffer));
        }

        return () => {
            if (handlerIdRef.current !== null && buffer) {
                GObject.signalHandlerDisconnect(buffer, handlerIdRef.current);
                handlerIdRef.current = null;
            }
            if (displayRef.current && providerRef.current) {
                Gtk.StyleContext.removeProviderForDisplay(displayRef.current, providerRef.current);
            }
        };
    }, [handleBufferChanged]);

    return (
        <GtkScrolledWindow hexpand vexpand cssClasses={["demo"]}>
            <GtkTextView
                ref={textViewRef}
                monospace
                topMargin={8}
                bottomMargin={8}
                leftMargin={8}
                rightMargin={8}
            />
        </GtkScrolledWindow>
    );
};

export const cssBasicsDemo: Demo = {
    id: "css-basics",
    title: "Theming/CSS Basics",
    description:
        "GTK themes are written using CSS. Every widget is build of multiple items that you can style very similarly to a regular website.",
    keywords: ["css", "style", "theme", "theming", "GtkCssProvider"],
    component: CssBasicsDemo,
    sourceCode,
};
