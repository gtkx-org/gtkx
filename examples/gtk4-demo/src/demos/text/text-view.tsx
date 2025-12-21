import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const TextViewDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Text View" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About TextView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkTextView is a multi-line text editor widget. It supports rich text formatting, undo/redo, and can be used for code editors, notes, and more."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Basic Text Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkScrolledWindow heightRequest={150} hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <GtkTextView
                        editable
                        wrapMode={Gtk.WrapMode.WORD_CHAR}
                        monospace={false}
                        cssClasses={["card"]}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                        marginBottom={8}
                    />
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Monospace / Code Editor" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel label="Use monospace font for code editing." wrap cssClasses={["dim-label"]} />
                <GtkScrolledWindow heightRequest={150} hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <GtkTextView
                        editable
                        wrapMode={Gtk.WrapMode.NONE}
                        monospace
                        cssClasses={["card"]}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                        marginBottom={8}
                    />
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Read-Only Text" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkScrolledWindow heightRequest={100} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkTextView
                        editable={false}
                        wrapMode={Gtk.WrapMode.WORD}
                        cursorVisible={false}
                        cssClasses={["card"]}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                        marginBottom={8}
                    />
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Key properties: editable, wrapMode (NONE, CHAR, WORD, WORD_CHAR), monospace, cursorVisible, leftMargin, rightMargin."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const textViewDemo: Demo = {
    id: "textview",
    title: "Text View",
    description: "Multi-line text editor with rich formatting support.",
    keywords: ["text", "textview", "editor", "multiline", "GtkTextView"],
    component: TextViewDemo,
    sourcePath: getSourcePath(import.meta.url, "text-view.tsx"),
};
