import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Entry, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ClipboardDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Clipboard" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Clipboard" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GTK provides clipboard support for copying and pasting text, images, and other data between applications."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Text Clipboard" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Use standard copy/paste shortcuts (Ctrl+C, Ctrl+V) in the entry below."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Entry placeholderText="Type text and use Ctrl+C to copy..." />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Clipboard API" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Programmatic clipboard access is available through Gdk.Display.getClipboard(). Full clipboard API support is planned for future GTKX releases."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
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
