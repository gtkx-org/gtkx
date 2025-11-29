import { readFileSync } from "node:fs";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { Box, Button, Label, ScrolledWindow } from "@gtkx/react";
import { useEffect, useMemo, useRef } from "react";

interface SourceViewerProps {
    sourcePath: string | null;
    title?: string;
}

export const SourceViewer = ({ sourcePath, title = "Source Code" }: SourceViewerProps) => {
    const scrollWindowRef = useRef<Gtk.ScrolledWindow | null>(null);
    const bufferRef = useRef<GtkSource.Buffer | null>(null);

    const source = useMemo(() => {
        if (!sourcePath) return null;
        try {
            return readFileSync(sourcePath, "utf-8");
        } catch {
            return null;
        }
    }, [sourcePath]);

    useEffect(() => {
        const scrollWindow = scrollWindowRef.current;
        if (!scrollWindow || bufferRef.current) return;

        const langManager = GtkSource.LanguageManager.getDefault();
        const language = langManager.guessLanguage("example.tsx");

        const schemeManager = GtkSource.StyleSchemeManager.getDefault();
        const scheme = schemeManager.getScheme("Adwaita-dark");

        const buffer = new GtkSource.Buffer();
        if (language) buffer.setLanguage(language);
        buffer.setHighlightSyntax(true);
        if (scheme) buffer.setStyleScheme(scheme);
        bufferRef.current = buffer;

        const view = GtkSource.View.viewNewWithBuffer(buffer);
        view.setEditable(false);
        view.setCursorVisible(false);
        view.setMonospace(true);
        view.setShowLineNumbers(true);
        view.setLeftMargin(8);
        view.setRightMargin(16);
        view.setTopMargin(8);
        view.setBottomMargin(8);
        view.setWrapMode(Gtk.WrapMode.NONE);
        scrollWindow.setChild(view);
    }, []);

    useEffect(() => {
        const buffer = bufferRef.current;
        if (buffer) {
            buffer.setText(source ?? "", -1);
        }
    }, [source]);

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
            <Box
                orientation={Gtk.Orientation.VERTICAL}
                spacing={0}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                vexpand
                hexpand
            >
                <Label.Root label="No source available" cssClasses={["dim-label"]} />
            </Box>
        );
    }

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <Box
                orientation={Gtk.Orientation.HORIZONTAL}
                spacing={8}
                marginStart={16}
                marginEnd={16}
                marginTop={8}
                marginBottom={8}
            >
                <Label.Root label={title} cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
                <Button
                    iconName="edit-copy-symbolic"
                    cssClasses={["flat"]}
                    tooltipText="Copy source code"
                    onClicked={handleCopy}
                />
            </Box>
            <ScrolledWindow ref={scrollWindowRef} vexpand hexpand />
        </Box>
    );
};
