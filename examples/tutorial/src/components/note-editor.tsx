import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkEntry, GtkScrolledWindow, GtkTextView } from "@gtkx/react";
import type { Note } from "../types.js";

const titleEntry = css`
    font-size: 18px;
    font-weight: bold;
`;

const bodyView = css`
    padding: 12px;
    font-size: 14px;
`;

export const NoteEditor = ({
    note,
    onUpdate,
}: {
    note: Note;
    onUpdate: (fields: Partial<Pick<Note, "title" | "body">>) => void;
}) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
        <GtkEntry
            text={note.title}
            placeholderText="Note title"
            cssClasses={[titleEntry]}
            onChanged={(self) => onUpdate({ title: self.text ?? "" })}
        />
        <GtkScrolledWindow vexpand>
            <GtkTextView
                wrapMode={Gtk.WrapMode.WORD_CHAR}
                cssClasses={[bodyView]}
                enableUndo
                onBufferChanged={(buffer) => {
                    const start = buffer.getStartIter();
                    const end = buffer.getEndIter();
                    onUpdate({ body: buffer.getText(start, end, false) ?? "" });
                }}
            >
                {note.body}
            </GtkTextView>
        </GtkScrolledWindow>
    </GtkBox>
);
