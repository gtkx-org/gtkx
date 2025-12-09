import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, ListView } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

const tasks: Task[] = [
    { id: "1", title: "Learn GTK4", completed: true },
    { id: "2", title: "Build a React app", completed: true },
    { id: "3", title: "Create GTK bindings", completed: true },
    { id: "4", title: "Write documentation", completed: false },
    { id: "5", title: "Add more demos", completed: false },
    { id: "6", title: "Test everything", completed: false },
    { id: "7", title: "Ship the project", completed: false },
];

const ListViewDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="List View" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About ListView" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="ListView is a high-performance scrollable list that efficiently handles large datasets using virtual scrolling. It only renders visible items."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Task List" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]} heightRequest={250}>
                    <ListView.Root
                        vexpand
                        renderItem={(task: Task | null) => (
                            <Label.Root
                                label={task?.title ?? ""}
                                cssClasses={task?.completed ? ["dim-label"] : []}
                                halign={Gtk.Align.START}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={8}
                                marginBottom={8}
                            />
                        )}
                    >
                        {tasks.map((task) => (
                            <ListView.Item key={task.id} item={task} />
                        ))}
                    </ListView.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="ListView uses a renderItem prop that returns JSX for each item. The widget is created once during setup and updated with item data during bind. This pattern ensures optimal performance with recycled widgets."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const listViewDemo: Demo = {
    id: "listview",
    title: "List View",
    description: "High-performance scrollable list with virtual scrolling.",
    keywords: ["listview", "list", "scroll", "virtual", "performance", "GtkListView"],
    component: ListViewDemo,
    sourcePath: getSourcePath(import.meta.url, "list-view.tsx"),
};
