import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import type { Selection } from "../types.js";
import { TaskRow } from "./task-row.js";

export const TaskList = ({ selection }: { selection: Selection }) => {
    const tasks = useStore((state) => state.tasks);
    const addTask = useStore((state) => state.addTask);
    const visible = tasks.filter(
        (task) => !task.deleted && task.listId === selection.listId,
    );

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp
                maximumSize={640}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkListBox
                    valign={Gtk.Align.START}
                    selectionMode={Gtk.SelectionMode.NONE}
                    cssClasses={["boxed-list"]}
                >
                    <AdwEntryRow
                        title="Add a task…"
                        onEntryActivated={(self) => {
                            addTask(selection.listId, self.text);
                            self.text = "";
                        }}
                    />
                    {visible.map((task) => (
                        <TaskRow key={task.id} task={task} />
                    ))}
                </GtkListBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
