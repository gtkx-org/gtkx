import * as Gdk from "@gtkx/gi/gdk";
import type * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { cssParserWarningQuark } from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import type { RefObject } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";

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
    displayRef: RefObject<Gdk.Display | null>;
    handleParsingError: (section: Gtk.CssSection, error: GLib.Error) => void;
}

const setupProvider = ({ providerRef, displayRef, handleParsingError }: SetupProviderArgs) => {
    const provider = new Gtk.CssProvider();
    providerRef.current = provider;

    provider.on("parsing-error", handleParsingError);

    const display = Gdk.DisplayManager.get().getDefaultDisplay();
    displayRef.current = display;
    if (display) Gtk.StyleContext.addProviderForDisplay(display, provider, 0xffffffff);

    return () => {
        if (providerRef.current) {
            providerRef.current.off("parsing-error", handleParsingError);
        }
        if (displayRef.current && providerRef.current) {
            Gtk.StyleContext.removeProviderForDisplay(displayRef.current, providerRef.current);
        }
    };
};

export function useCssEditor(defaultCss: string) {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const providerRef = useRef<Gtk.CssProvider | null>(null);
    const displayRef = useRef<Gdk.Display | null>(null);
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
            displayRef,
            handleParsingError,
        });
        providerRef.current?.loadFromString(defaultCss);
        return cleanup;
    }, [defaultCss, handleParsingError]);

    return { textViewRef, onBufferChanged };
}
