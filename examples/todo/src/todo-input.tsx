import { getInterface } from "@gtkx/ffi";
import { Editable, type Entry as GtkEntry, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Entry } from "@gtkx/react";
import { useState } from "react";

type TodoInputProps = {
    onAdd: (text: string) => void;
};

export const TodoInput = ({ onAdd }: TodoInputProps) => {
    const [text, setText] = useState("");

    const handleChange = (entry: GtkEntry) => {
        setText(getInterface(entry, Editable)?.getText() ?? "");
    };

    const handleAdd = () => {
        const trimmed = text.trim();

        if (trimmed) {
            onAdd(trimmed);
            setText("");
        }
    };

    return (
        <Box orientation={Orientation.HORIZONTAL} spacing={8}>
            <Entry
                text={text}
                onChanged={handleChange}
                onActivate={handleAdd}
                placeholderText="Add a new task…"
                hexpand
                name="todo-input"
            />
            <Button
                iconName="list-add-symbolic"
                tooltipText="Add task"
                cssClasses={["suggested-action"]}
                onClicked={handleAdd}
                name="add-button"
            />
        </Box>
    );
};
