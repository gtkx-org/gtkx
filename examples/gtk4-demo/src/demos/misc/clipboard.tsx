import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkEntry, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ClipboardDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Clipboard" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Clipboard" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK provides clipboard support for copying and pasting text, images, and other data between applications."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Text Clipboard" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use standard copy/paste shortcuts (Ctrl+C, Ctrl+V) in the entry below."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkEntry placeholderText="Type text and use Ctrl+C to copy..." />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Clipboard API" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Programmatic clipboard access is available through Gdk.Display.getClipboard(). Full clipboard API support is planned for future GTKX releases."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const clipboardDemo: Demo = {
    id: "clipboard",
    title: "Clipboard",
    description: "Copy and paste data between applications.",
    keywords: ["clipboard", "copy", "paste", "cut"],
    component: ClipboardDemo,
    sourcePath: getSourcePath(import.meta.url, "clipboard.tsx"),
};
