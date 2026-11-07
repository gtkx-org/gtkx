import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import { TaskRow } from "./task-row.js";

export const TaskList = () => {
    const tasks = useStore((state) => state.tasks);
    const addTask = useStore((state) => state.addTask);

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
                            addTask("personal", self.text);
                            self.text = "";
                        }}
                    />
                    {tasks
                        .filter((task) => !task.deleted)
                        .map((task) => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                </GtkListBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
