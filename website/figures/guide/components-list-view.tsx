import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";

type Task = { id: string; title: string };

const tasks: Task[] = [
    { id: "welcome", title: "Welcome to Tasks" },
    { id: "milk", title: "Buy oat milk" },
    { id: "dentist", title: "Book the dentist" },
    { id: "passport", title: "Renew passport" },
];

export function TaskList() {
    const [selectedIds, setSelectedIds] = useState(["milk", "dentist"]);

    return (
        <ListView<Task>
            items={tasks.map((task) => ({ id: task.id, value: task }))}
            selectionMode={Gtk.SelectionMode.MULTIPLE}
            selectedIds={selectedIds}
            onSelectionChanged={setSelectedIds}
            estimatedItemHeight={56}
            renderItem={({ item }) => (
                <GtkLabel
                    halign={Gtk.Align.START}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={12}
                    marginBottom={12}
                >
                    {item.title}
                </GtkLabel>
            )}
        />
    );
}
