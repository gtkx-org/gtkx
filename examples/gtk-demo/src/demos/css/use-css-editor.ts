import type * as GLib from "@gtkx/gi/glib";
import type { RefObject } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { cssParserWarningQuark } from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { useSignal } from "@gtkx/react";
import { useLayoutEffect, useRef, useState } from "react";

type MarkParsingErrorArgs = {
    textView: Gtk.TextView | null;
    section: Gtk.CssSection;
    error: GLib.Error;
    warningTag: Gtk.TextTag | null;
    errorTag: Gtk.TextTag | null;
};

type SetupTagsArgs = {
    buffer: Gtk.TextBuffer;
    errorTagRef: RefObject<Gtk.TextTag | null>;
    warningTagRef: RefObject<Gtk.TextTag | null>;
};

type InstallProviderArgs = {
    textViewRef: RefObject<Gtk.TextView | null>;
    errorTagRef: RefObject<Gtk.TextTag | null>;
    warningTagRef: RefObject<Gtk.TextTag | null>;
    provider: Gtk.CssProvider;
    defaultCss: string;
};

const clearTags = (buffer: Gtk.TextBuffer) => {
    const startIter = buffer.getStartIter();
    const endIter = buffer.getEndIter();
    buffer.removeAllTags(startIter, endIter);
};

const markParsingError = ({ textView, section, error, warningTag, errorTag }: MarkParsingErrorArgs) => {
    if (!textView) {
        return;
    }

    const buffer = textView.getBuffer();
    const startLocation = section.getStartLocation();
    const endLocation = section.getEndLocation();
    const [, startIter] = buffer.getIterAtLineIndex(startLocation.lines, startLocation.lineBytes);
    const [, endIter] = buffer.getIterAtLineIndex(endLocation.lines, endLocation.lineBytes);
    const isWarning = error.domain === cssParserWarningQuark();
    const tag = isWarning ? warningTag : errorTag;

    if (tag) {
        buffer.applyTag(tag, startIter, endIter);
    }
};

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

const installProvider = ({ textViewRef, errorTagRef, warningTagRef, provider, defaultCss }: InstallProviderArgs) => {
    const textView = textViewRef.current;

    if (!textView) {
        return;
    }

    const buffer = textView.getBuffer();
    setupTags({ buffer, errorTagRef, warningTagRef });
    const display = Gdk.DisplayManager.get().getDefaultDisplay();

    if (display) {
        Gtk.StyleContext.addProviderForDisplay(display, provider, 0xFF_FF_FF_FF);
    }

    provider.loadFromString(defaultCss);

    return () => {
        if (display) {
            Gtk.StyleContext.removeProviderForDisplay(display, provider);
        }
    };
};

function useCssEditor(defaultCss: string) {
    const textViewRef = useRef<Gtk.TextView | null>(null);
    const [provider] = useState(() => new Gtk.CssProvider());
    const errorTagRef = useRef<Gtk.TextTag | null>(null);
    const warningTagRef = useRef<Gtk.TextTag | null>(null);

    useSignal(provider, "parsing-error", (section: Gtk.CssSection, error: GLib.Error) => {
        markParsingError({
            textView: textViewRef.current,
            section,
            error,
            warningTag: warningTagRef.current,
            errorTag: errorTagRef.current,
        });
    },
    );

    const onChanged = (buffer: Gtk.TextBuffer) => {
        clearTags(buffer);
        const startIter = buffer.getStartIter();
        const endIter = buffer.getEndIter();
        const text = buffer.getText(startIter, endIter, false);
        provider.loadFromString(text);
    };

    useLayoutEffect(
        () => installProvider({ textViewRef, errorTagRef, warningTagRef, provider, defaultCss }),
        [defaultCss, provider],
    );

    return { textViewRef, onChanged };
}

export { useCssEditor };
