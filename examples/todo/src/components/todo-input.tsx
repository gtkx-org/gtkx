import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry } from "@gtkx/react";
import { useRef, useState } from "react";

interface TodoInputProps {
    onAdd: (text: string) => void;
}

export const TodoInput = ({ onAdd }: TodoInputProps) => {
    const [text, setText] = useState("");
    const entryRef = useRef<Gtk.Entry | null>(null);

    const handleAdd = () => {
        if (text.trim()) {
            onAdd(text);
            setText("");
            entryRef.current?.grabFocus();
        }
    };

    return (
        <GtkBox cssClasses={["linked"]}>
            <GtkEntry
                ref={entryRef}
                text={text}
                placeholderText="What needs to be done?"
                hexpand
                onChanged={(entry: Gtk.Entry) => setText(entry.getText())}
                onActivate={handleAdd}
                name="todo-input"
            />
            <GtkButton
                label="Add"
                cssClasses={["suggested-action"]}
                onClicked={handleAdd}
                sensitive={text.trim().length > 0}
                name="add-button"
            />
        </GtkBox>
    );
};
