import * as Gdk from "@gtkx/ffi/gdk";
import type * as GLib from "@gtkx/ffi/glib";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { cssParserWarningQuark } from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
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
    const parsingErrorHandlerIdRef = useRef<number | null>(null);
    const errorTagRef = useRef<Gtk.TextTag | null>(null);
    const warningTagRef = useRef<Gtk.TextTag | null>(null);

    const clearTags = useCallback((buffer: Gtk.TextBuffer) => {
        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();
        buffer.getStartIter(startIter);
        buffer.getEndIter(endIter);

        if (errorTagRef.current) {
            buffer.removeTag(errorTagRef.current, startIter, endIter);
        }
        if (warningTagRef.current) {
            buffer.removeTag(warningTagRef.current, startIter, endIter);
        }
    }, []);

    const handleParsingError = useCallback(
        (_provider: Gtk.CssProvider, section: Gtk.CssSection, error: GLib.GError) => {
            const textView = textViewRef.current;
            if (!textView) return;

            const buffer = textView.getBuffer();
            if (!buffer) return;

            const startLocation = section.getStartLocation();
            const endLocation = section.getEndLocation();

            const startIter = new Gtk.TextIter();
            const endIter = new Gtk.TextIter();

            buffer.getIterAtLineOffset(startIter, startLocation.lines, startLocation.lineChars);
            buffer.getIterAtLineOffset(endIter, endLocation.lines, endLocation.lineChars);

            const isWarning = error.domain === cssParserWarningQuark();
            const tag = isWarning ? warningTagRef.current : errorTagRef.current;

            if (tag) {
                buffer.applyTag(tag, startIter, endIter);
            }
        },
        [],
    );

    const handleBufferChanged = useCallback(
        (buffer: Gtk.TextBuffer) => {
            clearTags(buffer);

            const startIter = new Gtk.TextIter();
            const endIter = new Gtk.TextIter();
            buffer.getStartIter(startIter);
            buffer.getEndIter(endIter);
            const text = buffer.getText(startIter, endIter, false);

            if (providerRef.current) {
                providerRef.current.loadFromString(text);
            }
        },
        [clearTags],
    );

    useEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;

        const buffer = textView.getBuffer();
        if (!buffer) return;

        const tagTable = buffer.getTagTable();

        const errorTag = new Gtk.TextTag("error");
        errorTag.setUnderline(Pango.Underline.ERROR);
        tagTable.add(errorTag);
        errorTagRef.current = errorTag;

        const warningTag = new Gtk.TextTag("warning");
        warningTag.setUnderline(Pango.Underline.SINGLE);
        warningTag.setBackground("#ffff88");
        tagTable.add(warningTag);
        warningTagRef.current = warningTag;

        const provider = new Gtk.CssProvider();
        providerRef.current = provider;

        parsingErrorHandlerIdRef.current = provider.connect("parsing-error", handleParsingError);

        const display = Gdk.DisplayManager.get().getDefaultDisplay();
        displayRef.current = display;

        if (display) {
            Gtk.StyleContext.addProviderForDisplay(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
        }

        buffer.setText(DEFAULT_CSS, -1);
        handleBufferChanged(buffer);
        handlerIdRef.current = buffer.connect("changed", () => handleBufferChanged(buffer));

        return () => {
            if (handlerIdRef.current !== null && buffer) {
                GObject.signalHandlerDisconnect(buffer, handlerIdRef.current);
                handlerIdRef.current = null;
            }
            if (parsingErrorHandlerIdRef.current !== null && providerRef.current) {
                GObject.signalHandlerDisconnect(providerRef.current, parsingErrorHandlerIdRef.current);
                parsingErrorHandlerIdRef.current = null;
            }
            if (displayRef.current && providerRef.current) {
                Gtk.StyleContext.removeProviderForDisplay(displayRef.current, providerRef.current);
            }
        };
    }, [handleBufferChanged, handleParsingError]);

    return (
        <GtkScrolledWindow hexpand vexpand cssClasses={["demo"]}>
            <GtkTextView ref={textViewRef} monospace topMargin={8} bottomMargin={8} leftMargin={8} rightMargin={8} />
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
