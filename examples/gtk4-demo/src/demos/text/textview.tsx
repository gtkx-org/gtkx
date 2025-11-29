import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, ScrolledWindow, TextView } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const TextViewDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Text View" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkTextView is a multi-line text editor widget. It supports rich text formatting, undo/redo, and can be used for code editors, notes, and more."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Basic Text Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <ScrolledWindow heightRequest={150} hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <TextView
                        editable
                        wrapMode={Gtk.WrapMode.WORD_CHAR}
                        monospace={false}
                        cssClasses={["card"]}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                        marginBottom={8}
                    />
                </ScrolledWindow>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Monospace / Code Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root label="Use monospace font for code editing." wrap cssClasses={["dim-label"]} />
                <ScrolledWindow heightRequest={150} hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <TextView
                        editable
                        wrapMode={Gtk.WrapMode.NONE}
                        monospace
                        cssClasses={["card"]}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                        marginBottom={8}
                    />
                </ScrolledWindow>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Read-Only Text" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <ScrolledWindow heightRequest={100} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <TextView
                        editable={false}
                        wrapMode={Gtk.WrapMode.WORD}
                        cursorVisible={false}
                        cssClasses={["card"]}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                        marginBottom={8}
                    />
                </ScrolledWindow>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Key properties: editable, wrapMode (NONE, CHAR, WORD, WORD_CHAR), monospace, cursorVisible, leftMargin, rightMargin."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const textViewDemo: Demo = {
    id: "textview",
    title: "Text View",
    description: "Multi-line text editor with rich formatting support.",
    keywords: ["text", "textview", "editor", "multiline", "GtkTextView"],
    component: TextViewDemo,
    sourcePath: getSourcePath(import.meta.url, "textview.tsx"),
};
