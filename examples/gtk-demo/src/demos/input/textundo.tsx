import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textundo.tsx?raw";

const INITIAL_TEXT = `The GtkTextView supports undo and redo through the use of a GtkTextBuffer. You can enable or disable undo support using gtk_text_buffer_set_enable_undo().
Type to add more text.
Use Control+z to undo and Control+Shift+z or Control+y to redo previously undone operations.`;

const TextUndoDemo = () => {
    const textViewRef = useRef<Gtk.TextView | null>(null);

    useEffect(() => {
        const textView = textViewRef.current;
        if (!textView) return;

        const buffer = textView.getBuffer();
        if (!buffer) return;

        buffer.setEnableUndo(true);
        buffer.beginIrreversibleAction();
        const iter = new Gtk.TextIter();
        buffer.getStartIter(iter);
        buffer.insert(iter, INITIAL_TEXT, -1);
        buffer.endIrreversibleAction();
    }, []);

    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
            <GtkTextView
                ref={textViewRef}
                wrapMode={Gtk.WrapMode.WORD}
                pixelsBelowLines={10}
                leftMargin={20}
                rightMargin={20}
                topMargin={20}
                bottomMargin={20}
            />
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
};
