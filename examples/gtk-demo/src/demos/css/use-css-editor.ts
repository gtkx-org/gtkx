import * as Gdk from "@gtkx/ffi/gdk";
import type * as GLib from "@gtkx/ffi/glib";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { cssParserWarningQuark } from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const clearTags = (buffer: Gtk.TextBuffer) => {
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    buffer.removeAllTags(startIter, endIter);
};

interface MarkParsingErrorArgs {
    textView: Gtk.TextView | null;
    section: Gtk.CssSection;
    error: GLib.Error;
    warningTag: Gtk.TextTag | null;
    errorTag: Gtk.TextTag | null;
}

const markParsingError = ({ textView, section, error, warningTag, errorTag }: MarkParsingErrorArgs) => {
    if (!textView) return;
    const buffer = textView.getBuffer();
    if (!buffer) return;

    const startLocation = section.getStartLocation();
    const endLocation = section.getEndLocation();

    const [, startIter] = buffer.getIterAtLineIndex(startLocation.lines, startLocation.lineBytes);
    const [, endIter] = buffer.getIterAtLineIndex(endLocation.lines, endLocation.lineBytes);

    const isWarning = error.domain === cssParserWarningQuark();
    const tag = isWarning ? warningTag : errorTag;
    if (tag) buffer.applyTag(tag, startIter, endIter);
};

interface SetupTagsArgs {
    buffer: Gtk.TextBuffer;
    errorTagRef: RefObject<Gtk.TextTag | null>;
    warningTagRef: RefObject<Gtk.TextTag | null>;
}

const setupTags = ({ buffer, errorTagRef, warningTagRef }: SetupTagsArgs) => {
    const tagTable = buffer.getTagTable();

    const errorTag = Gtk.TextTag.new("error");
    errorTag.underline = Pango.Underline.ERROR;
    tagTable.add(errorTag);
    errorTagRef.current = errorTag;

    const warningTag = Gtk.TextTag.new("warning");
    warningTag.underline = Pango.Underline.SINGLE;
    tagTable.add(warningTag);
    warningTagRef.current = warningTag;
};

interface SetupProviderArgs {
    providerRef: RefObject<Gtk.CssProvider | null>;
    parsingErrorHandlerIdRef: RefObject<number | null>;
    displayRef: RefObject<Gdk.Display | null>;
    handleParsingError: (section: Gtk.CssSection, error: GLib.Error) => void;
}

const setupProvider = ({
    providerRef,
    parsingErrorHandlerIdRef,
    displayRef,
    handleParsingError,
}: SetupProviderArgs) => {
    const provider = new Gtk.CssProvider();
    providerRef.current = provider;

    parsingErrorHandlerIdRef.current = provider.connect("parsing-error", handleParsingError);

    const display = Gdk.DisplayManager.get().getDefaultDisplay();
    displayRef.current = display;
    if (display) Gtk.StyleContext.addProviderForDisplay(display, provider, 0xffffffff);

    return () => {
        if (parsingErrorHandlerIdRef.current !== null && providerRef.current) {
            GObject.signalHandlerDisconnect(providerRef.current, parsingErrorHandlerIdRef.current);
            parsingErrorHandlerIdRef.current = null;
        }
        if (displayRef.current && providerRef.current) {
            Gtk.StyleContext.removeProviderForDisplay(displayRef.current, providerRef.current);
        }
    };
};

export function useCssEditor(windowRef: RefObject<Gtk.Window | null>, windowClasses: string[], defaultCss: string) {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const providerRef = useRef<Gtk.CssProvider | null>(null);
    const displayRef = useRef<Gdk.Display | null>(null);
    const parsingErrorHandlerIdRef = useRef<number | null>(null);
    const errorTagRef = useRef<Gtk.TextTag | null>(null);
    const warningTagRef = useRef<Gtk.TextTag | null>(null);

    const handleParsingError = useCallback(
        (section: Gtk.CssSection, error: GLib.Error) =>
            markParsingError({
                textView: textViewRef.current,
                section,
                error,
                warningTag: warningTagRef.current,
                errorTag: errorTagRef.current,
            }),
        [],
    );

    const onBufferChanged = useCallback((buffer: Gtk.TextBuffer) => {
        clearTags(buffer);
        const startIter = buffer.getStartIter();
        const endIter = buffer.getEndIter();
        const text = buffer.getText(startIter, endIter, false) ?? "";
        providerRef.current?.loadFromString(text);
    }, []);

    useLayoutEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;
        const buffer = textView.getBuffer();
        if (!buffer) return;

        setupTags({ buffer, errorTagRef, warningTagRef });
        const cleanup = setupProvider({
            providerRef,
            parsingErrorHandlerIdRef,
            displayRef,
            handleParsingError,
        });
        buffer.setText(defaultCss, -1);
        return cleanup;
    }, [defaultCss, handleParsingError]);

    useEffect(() => {
        const win = windowRef.current;
        if (!win) return;
        for (const cls of windowClasses) win.addCssClass(cls);
        return () => {
            for (const cls of windowClasses) win.removeCssClass(cls);
        };
    }, [windowRef, windowClasses]);

    return { textViewRef, onBufferChanged };
}
