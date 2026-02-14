import * as Gdk from "@gtkx/ffi/gdk";
import type * as GLib from "@gtkx/ffi/glib";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { cssParserWarningQuark } from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export function useCssEditor(windowRef: RefObject<Gtk.Window | null>, windowClasses: string[], defaultCss: string) {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const providerRef = useRef<Gtk.CssProvider | null>(null);
    const displayRef = useRef<Gdk.Display | null>(null);
    const parsingErrorHandlerIdRef = useRef<number | null>(null);
    const errorTagRef = useRef<Gtk.TextTag | null>(null);
    const warningTagRef = useRef<Gtk.TextTag | null>(null);

    const clearTags = useCallback((buffer: Gtk.TextBuffer) => {
        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();
        buffer.getStartIter(startIter);
        buffer.getEndIter(endIter);
        buffer.removeAllTags(startIter, endIter);
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

            buffer.getIterAtLineIndex(startIter, startLocation.getLines(), startLocation.getLineBytes());
            buffer.getIterAtLineIndex(endIter, endLocation.getLines(), endLocation.getLineBytes());

            const isWarning = error.getDomain() === cssParserWarningQuark();
            const tag = isWarning ? warningTagRef.current : errorTagRef.current;

            if (tag) {
                buffer.applyTag(tag, startIter, endIter);
            }
        },
        [],
    );

    const onBufferChanged = useCallback(
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

    useLayoutEffect(() => {
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
        tagTable.add(warningTag);
        warningTagRef.current = warningTag;

        const provider = new Gtk.CssProvider();
        providerRef.current = provider;

        parsingErrorHandlerIdRef.current = provider.connect("parsing-error", handleParsingError);

        const display = Gdk.DisplayManager.get().getDefaultDisplay();
        displayRef.current = display;

        if (display) {
            Gtk.StyleContext.addProviderForDisplay(display, provider, 0xffffffff);
        }

        buffer.setText(defaultCss, -1);

        return () => {
            if (parsingErrorHandlerIdRef.current !== null && providerRef.current) {
                GObject.signalHandlerDisconnect(providerRef.current, parsingErrorHandlerIdRef.current);
                parsingErrorHandlerIdRef.current = null;
            }
            if (displayRef.current && providerRef.current) {
                Gtk.StyleContext.removeProviderForDisplay(displayRef.current, providerRef.current);
            }
        };
    }, [defaultCss, handleParsingError]);

    useEffect(() => {
        const win = windowRef.current;
        if (!win) return;
        for (const cls of windowClasses) {
            win.addCssClass(cls);
        }
        return () => {
            for (const cls of windowClasses) {
                win.removeCssClass(cls);
            }
        };
    }, [windowRef, windowClasses]);

    return { textViewRef, onBufferChanged };
}
