import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry } from "@gtkx/react";
import { useState } from "react";

type TodoInputProps = {
    onAdd: (text: string) => void;
};

export const TodoInput = ({ onAdd }: TodoInputProps) => {
    const [text, setText] = useState("");

    const handleChange = (entry: Gtk.Entry) => {
        setText(entry.getText() ?? "");
    };

    const handleAdd = () => {
        const trimmed = text.trim();

        if (trimmed) {
            onAdd(trimmed);
            setText("");
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
            <GtkEntry
                text={text}
                onChanged={handleChange}
                onActivate={handleAdd}
                placeholderText="Add a new task…"
                hexpand
                name="todo-input"
            />
            <GtkButton
                iconName="list-add-symbolic"
                tooltipText="Add task"
                cssClasses={["suggested-action"]}
                onClicked={handleAdd}
                name="add-button"
            />
        </GtkBox>
    );
};
