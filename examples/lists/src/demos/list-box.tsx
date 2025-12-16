import * as Gtk from "@gtkx/ffi/gtk";
import { Box, CheckButton, Label, ListBox, ScrolledWindow } from "@gtkx/react";
import { useCallback, useState } from "react";

interface Task {
    id: number;
    title: string;
    completed: boolean;
    priority: "low" | "medium" | "high";
}

const initialTasks: Task[] = [
    { id: 1, title: "Review pull requests", completed: false, priority: "high" },
    { id: 2, title: "Write documentation", completed: false, priority: "medium" },
    { id: 3, title: "Fix reported bugs", completed: true, priority: "high" },
    { id: 4, title: "Update dependencies", completed: false, priority: "low" },
    { id: 5, title: "Add unit tests", completed: false, priority: "medium" },
    { id: 6, title: "Refactor old code", completed: true, priority: "low" },
];

const priorityColors: Record<Task["priority"], string> = {
    low: "success",
    medium: "warning",
    high: "error",
};

export const ListBoxDemo = () => {
    const [tasks, setTasks] = useState(initialTasks);

    const toggleTask = useCallback((id: number) => {
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
    }, []);

    const activeCount = tasks.filter((t) => !t.completed).length;

    return (
        <Box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="ListBox" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkListBox is a vertical container for rows that can be dynamically sorted and filtered. It's ideal for small to medium lists where each row can have complex widgets."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12} vexpand>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <Label label="Task List" cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
                    <Label label={`${activeCount} remaining`} cssClasses={["dim-label"]} />
                </Box>

                <ScrolledWindow vexpand cssClasses={["card"]}>
                    <ListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                        {tasks.map((task) => (
                            <Box
                                key={task.id}
                                orientation={Gtk.Orientation.HORIZONTAL}
                                spacing={12}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={8}
                                marginBottom={8}
                            >
                                <CheckButton.Root active={task.completed} onToggled={() => toggleTask(task.id)} />
                                <Label
                                    label={task.title}
                                    hexpand
                                    halign={Gtk.Align.START}
                                    cssClasses={task.completed ? ["dim-label"] : []}
                                />
                                <Label label={task.priority} cssClasses={["caption", priorityColors[task.priority]]} />
                            </Box>
                        ))}
                    </ListBox>
                </ScrolledWindow>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Supports selection modes: none, single, browse, multiple\n• Rows can contain any widgets\n• Built-in keyboard navigation\n• Supports placeholder for empty state"
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};
