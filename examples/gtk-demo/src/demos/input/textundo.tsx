import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./textundo.tsx?raw";

const INITIAL_TEXT = `The GtkTextView supports undo and redo through the use of a GtkTextBuffer. You can enable or disable undo support using gtk_text_buffer_set_enable_undo().
Type to add more text.
Use Control+z to undo and Control+Shift+z or Control+y to redo previously undone operations.`;

const TextUndoDemo = () => {
    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            <GtkTextView
                wrapMode={Gtk.WrapMode.WORD}
                pixelsBelowLines={10}
                leftMargin={20}
                rightMargin={20}
                topMargin={20}
                bottomMargin={20}
                enableUndo
            >
                {INITIAL_TEXT}
            </GtkTextView>
        </GtkScrolledWindow>
    );
};

export const textundoDemo: Demo = {
    id: "textundo",
    title: "Text View/Undo and Redo",
    description:
        "The GtkTextView supports undo and redo through the use of a GtkTextBuffer. You can enable or disable undo support using gtk_text_buffer_set_enable_undo(). Use Control+z to undo and Control+Shift+z or Control+y to redo previously undone operations.",
    keywords: ["textview", "undo", "redo", "GtkTextBuffer", "GtkTextView"],
    component: TextUndoDemo,
    sourceCode,
    defaultWidth: 330,
    defaultHeight: 330,
};
