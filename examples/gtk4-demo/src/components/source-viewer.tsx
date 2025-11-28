import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkFfi from "@gtkx/ffi/gtk";
import { Box, Button, Label, ScrolledWindow, TextView } from "@gtkx/gtkx";
import { useMemo, useRef } from "react";

interface SourceViewerProps {
    source: string | null;
    title?: string;
}

export const SourceViewer = ({ source, title = "Source Code" }: SourceViewerProps) => {
    const textViewRef = useRef<GtkFfi.TextView | null>(null);

    const buffer = useMemo(() => {
        const buf = new GtkFfi.TextBuffer(null);
        if (source) {
            buf.setText(source, -1);
        }
        return buf;
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
            <ScrolledWindow vexpand hexpand>
                <TextView
                    ref={textViewRef}
                    buffer={buffer}
                    editable={false}
                    cursorVisible={false}
                    monospace
                    leftMargin={16}
                    rightMargin={16}
                    topMargin={8}
                    bottomMargin={8}
                    wrapMode={Gtk.WrapMode.NONE}
                />
            </ScrolledWindow>
        </Box>
    );
};
