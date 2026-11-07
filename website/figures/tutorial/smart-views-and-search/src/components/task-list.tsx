import { markupEscapeText } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp, AdwEntryRow, AdwStatusPage } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkListBox,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
} from "@gtkx/jsx/gtk";
import type { Selection } from "../types.js";
import { useStore } from "../store/index.js";
import { addListId, emptyState, visibleTasks } from "../store/selectors.js";
import { TaskFilter } from "./task-filter.js";
import { TaskRow } from "./task-row.js";

export const TaskList = ({ selection }: { selection: Selection }) => {
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const filter = useStore((state) => state.filter);
    const searchMode = useStore((state) => state.searchMode);
    const searchQuery = useStore((state) => state.searchQuery);
    const setSearchMode = useStore((state) => state.setSearchMode);
    const setSearchQuery = useStore((state) => state.setSearchQuery);
    const addTask = useStore((state) => state.addTask);

    const visible = visibleTasks(tasks, selection, {
        query: searchQuery,
        filter,
    });
    const empty = emptyState(selection, searchQuery);
    const listId = addListId(selection, lists);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
            <GtkSearchBar
                searchModeEnabled={searchMode}
                onNotifySearchModeEnabled={(enabled) =>
                    setSearchMode(enabled ?? false)
                }
            >
                <GtkSearchEntry
                    placeholderText="Search tasks…"
                    text={searchQuery}
                    onSearchChanged={(self) => setSearchQuery(self.text)}
                />
            </GtkSearchBar>
            <GtkScrolledWindow vexpand>
                <AdwClamp
                    maximumSize={640}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <TaskFilter />
                        <GtkListBox
                            selectionMode={Gtk.SelectionMode.NONE}
                            cssClasses={["boxed-list"]}
                        >
                            <AdwEntryRow
                                title="Add a task…"
                                onEntryActivated={(self) => {
                                    addTask(listId, self.text);
                                    self.text = "";
                                }}
                            />
                            {visible.map((task) => (
                                <TaskRow key={task.id} task={task} />
                            ))}
                        </GtkListBox>
                        {visible.length === 0 ? (
                            <AdwStatusPage
                                cssClasses={["compact"]}
                                iconName={empty.icon}
                                title={empty.title}
                                description={markupEscapeText(
                                    empty.description,
                                    -1,
                                )}
                            />
                        ) : null}
                    </GtkBox>
                </AdwClamp>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
