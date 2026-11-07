import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwClamp } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Task } from "../types.js";

const createdAt = new Date().toISOString();

const TASKS: Task[] = [
    {
        id: "t1",
        listId: "personal",
        title: "Welcome to Tasks",
        notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
        done: false,
        important: false,
        deleted: false,
        due: null,
        position: 0,
        createdAt,
        completedAt: null,
    },
    {
        id: "t2",
        listId: "personal",
        title: "Water the plants",
        notes: "",
        done: false,
        important: true,
        deleted: false,
        due: null,
        position: 1,
        createdAt,
        completedAt: null,
    },
    {
        id: "t3",
        listId: "work",
        title: "Prepare the weekly report",
        notes: "",
        done: false,
        important: false,
        deleted: false,
        due: null,
        position: 2,
        createdAt,
        completedAt: null,
    },
];

export const TaskList = () => (
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
                {TASKS.map((task) => (
                    <AdwActionRow
                        key={task.id}
                        title={task.title}
                        subtitle={task.notes}
                        useMarkup={false}
                    />
                ))}
            </GtkListBox>
        </AdwClamp>
    </GtkScrolledWindow>
);
