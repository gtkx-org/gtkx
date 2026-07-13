import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwButtonRow, AdwClamp, AdwEntryRow, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import { useRef } from "react";
import type { Task } from "../types.js";
import { TaskRow, type TaskRowHandlers } from "./task-row.js";

type TaskListProps = {
    tasks: Task[];
    reorderable: boolean;
    addPlaceholder: string;
    onAddTask: (title: string) => void;
    empty: { icon: string; title: string; description: string };
    search: {
        mode: boolean;
        onModeChange: (mode: boolean) => void;
        query: string;
        onQueryChange: (query: string) => void;
    };
    row: TaskRowHandlers;
};

export const TaskList = ({ tasks, reorderable, addPlaceholder, onAddTask, empty, search, row }: TaskListProps) => {
    const entryRef = useRef<Adw.EntryRow | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
            <GtkSearchBar
                searchModeEnabled={search.mode}
                onNotifySearchModeEnabled={(enabled) => search.onModeChange(enabled ?? false)}
            >
                <GtkSearchEntry
                    placeholderText="Search tasks…"
                    text={search.query}
                    onSearchChanged={(self) => search.onQueryChange(self.text)}
                />
            </GtkSearchBar>
            <GtkScrolledWindow vexpand>
                <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                            <AdwEntryRow
                                ref={entryRef}
                                title={addPlaceholder}
                                onEntryActivated={(self) => {
                                    onAddTask(self.text);
                                    self.text = "";
                                }}
                            />
                            {tasks.map((task) => (
                                <TaskRow key={task.id} task={task} reorderable={reorderable} {...row} />
                            ))}
                            {tasks.length > 0 ? (
                                <AdwButtonRow
                                    title="Add Task"
                                    startIconName="list-add-symbolic"
                                    onActivated={() => entryRef.current?.grabFocus()}
                                />
                            ) : null}
                        </GtkListBox>
                        {tasks.length === 0 ? (
                            <AdwStatusPage
                                cssClasses={["compact"]}
                                iconName={empty.icon}
                                title={empty.title}
                                description={empty.description}
                            />
                        ) : null}
                    </GtkBox>
                </AdwClamp>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
