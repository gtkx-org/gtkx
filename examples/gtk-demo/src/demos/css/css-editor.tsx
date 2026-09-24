import type * as GLib from "@gtkx/gi/glib";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { cssParserWarningQuark } from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkCssProvider, GtkTextBuffer, GtkTextTag, GtkTextView } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { useLayoutEffect, useRef, useState } from "react";

type CssEditorProps = {
    defaultCss: string;
};

type MarkParsingErrorArgs = {
    buffer: Gtk.TextBuffer | null;
    errorTag: Gtk.TextTag | null;
    warningTag: Gtk.TextTag | null;
    section: Gtk.CssSection;
    error: GLib.Error;
};

const clearTags = (buffer: Gtk.TextBuffer) => {
    buffer.removeAllTags(buffer.getStartIter(), buffer.getEndIter());
};

const markParsingError = ({ buffer, errorTag, warningTag, section, error }: MarkParsingErrorArgs) => {
    const tag = error.domain === cssParserWarningQuark() ? warningTag : errorTag;

    if (buffer === null || tag === null) {
        return;
    }

    const start = section.getStartLocation();
    const end = section.getEndLocation();
    const [, startIter] = buffer.getIterAtLineIndex(start.lines, start.lineBytes);
    const [, endIter] = buffer.getIterAtLineIndex(end.lines, end.lineBytes);
    buffer.applyTag(tag, startIter, endIter);
};

const loadCss = (provider: Gtk.CssProvider | null, buffer: Gtk.TextBuffer) => {
    clearTags(buffer);

    if (provider !== null) {
        provider.loadFromString(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false));
    }
};

const useInstalledProvider = (provider: Gtk.CssProvider | null, defaultCss: string) => {
    useLayoutEffect(() => {
        if (provider === null) {
            return;
        }

        const display = Gdk.DisplayManager.get().getDefaultDisplay();

        if (display) {
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            Gtk.StyleContext.addProviderForDisplay(display, provider, 0xFF_FF_FF_FF);
        }

        provider.loadFromString(defaultCss);

        return () => {
            if (display) {
                // eslint-disable-next-line @typescript-eslint/no-deprecated
                Gtk.StyleContext.removeProviderForDisplay(display, provider);
            }
        };
    }, [defaultCss, provider]);
};

function CssEditor({ defaultCss }: CssEditorProps) {
    const [provider, setProvider] = useState<Gtk.CssProvider | null>(null);
    const bufferRef = useRef<Gtk.TextBuffer | null>(null);
    const errorTagRef = useRef<Gtk.TextTag | null>(null);
    const warningTagRef = useRef<Gtk.TextTag | null>(null);

    const onParsingError = (section: Gtk.CssSection, error: GLib.Error) => {
        markParsingError({
            buffer: bufferRef.current,
            errorTag: errorTagRef.current,
            warningTag: warningTagRef.current,
            section,
            error,
        });
    };

    const onChanged = (buffer: Gtk.TextBuffer) => {
        loadCss(provider, buffer);
    };

    useInstalledProvider(provider, defaultCss);

    return (
        <>
            <GtkTextView
                accessibleLabel="CSS editor"
                buffer={(
                    <GtkTextBuffer ref={bufferRef} onChanged={onChanged}>
                        <GtkTextTag ref={errorTagRef} name="error" underline={Pango.Underline.ERROR} />
                        <GtkTextTag ref={warningTagRef} name="warning" underline={Pango.Underline.SINGLE} />
                        {defaultCss}
                    </GtkTextBuffer>
                )}
            />
            {createPortal(
                <GtkCssProvider ref={setProvider} onParsingError={onParsingError} />,
                rootElement,
            )}
        </>
    );
}

export { CssEditor };
