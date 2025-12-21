import { readFileSync } from "node:fs";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { GtkBox, GtkButton, GtkLabel, GtkScrolledWindow, GtkSourceView } from "@gtkx/react";
import { useEffect, useMemo, useRef } from "react";

interface SourceViewerProps {
    sourcePath: string | null;
    title?: string;
}

const createBuffer = (): GtkSource.Buffer => {
    const langManager = GtkSource.LanguageManager.getDefault();
    const language = langManager.guessLanguage("example.tsx");

    const schemeManager = GtkSource.StyleSchemeManager.getDefault();
    const scheme = schemeManager.getScheme("Adwaita-dark");

    const buffer = new GtkSource.Buffer();
    if (language) buffer.setLanguage(language);
    buffer.setHighlightSyntax(true);
    if (scheme) buffer.setStyleScheme(scheme);

    return buffer;
};

export const SourceViewer = ({ sourcePath, title = "Source Code" }: SourceViewerProps) => {
    const bufferRef = useRef<GtkSource.Buffer | null>(null);

    if (!bufferRef.current) {
        bufferRef.current = createBuffer();
    }

    const buffer = bufferRef.current;

    const source = useMemo(() => {
        if (!sourcePath) return null;
        try {
            return readFileSync(sourcePath, "utf-8");
        } catch {
            return null;
        }
    }, [sourcePath]);

    useEffect(() => {
        buffer.setText(source ?? "", -1);
    }, [source, buffer]);

    const handleCopy = () => {
        if (!source) return;
        const display = Gdk.Display.getDefault();
        if (display) {
            const clipboard = display.getClipboard();
            const encoder = new TextEncoder();
            const data = Array.from(encoder.encode(source));
            const bytes = new GLib.Bytes(data.length, data);
            const provider = new Gdk.ContentProvider("text/plain;charset=utf-8", bytes);
            clipboard.setContent(provider);
        }
    };

    if (!source) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={0}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                vexpand
                hexpand
            >
                <GtkLabel label="No source available" cssClasses={["dim-label"]} />
            </GtkBox>
        );
    }

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkBox
                orientation={Gtk.Orientation.HORIZONTAL}
                spacing={8}
                marginStart={16}
                marginEnd={16}
                marginTop={8}
                marginBottom={8}
            >
                <GtkLabel label={title} cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
                <GtkButton
                    iconName="edit-copy-symbolic"
                    cssClasses={["flat"]}
                    tooltipText="Copy source code"
                    onClicked={handleCopy}
                />
            </GtkBox>
            <GtkScrolledWindow vexpand hexpand>
                <GtkSourceView
                    buffer={buffer}
                    editable={false}
                    cursorVisible={false}
                    monospace
                    showLineNumbers
                    leftMargin={8}
                    rightMargin={16}
                    topMargin={8}
                    bottomMargin={8}
                    wrapMode={Gtk.WrapMode.NONE}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};
