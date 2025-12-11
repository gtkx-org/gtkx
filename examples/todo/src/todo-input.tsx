import { getInterface } from "@gtkx/ffi";
import { Editable, type Entry as GtkEntry, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Entry } from "@gtkx/react";
import { useState } from "react";

interface TodoInputProps {
    onAdd: (text: string) => void;
}

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

    const handleActivate = () => {
        handleAdd();
    };

    return (
        <Box orientation={Orientation.HORIZONTAL} spacing={8}>
            <Entry
                text={text}
                onChanged={handleChange}
                onActivate={handleActivate}
                placeholderText="What needs to be done?"
                hexpand={true}
                name="todo-input"
            />
            <Button label="Add" onClicked={handleAdd} name="add-button" />
        </Box>
    );
};
