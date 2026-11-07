import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";

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
                    {tasks.map((task) => (
                        <AdwActionRow
                            key={task.id}
                            title={task.title}
                            useMarkup={false}
                        />
                    ))}
                </GtkListBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
