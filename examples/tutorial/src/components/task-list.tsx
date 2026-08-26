import * as Gtk from "@gtkx/gi/gtk";
import { useTranslation } from "@gtkx/i18n";
import { AdwClamp, AdwEntryRow, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { useStore } from "../store/index.js";
import { addListId, emptyState, isReorderable, visibleTasks } from "../store/selectors.js";
import type { Selection } from "../types.js";
import { TaskRow } from "./task-row.js";

export const TaskList = ({ selection }: { selection: Selection }) => {
    const { t } = useTranslation();
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const filter = useStore((state) => state.filter);
    const searchMode = useStore((state) => state.searchMode);
    const searchQuery = useStore((state) => state.searchQuery);
    const setSearchMode = useStore((state) => state.setSearchMode);
    const setSearchQuery = useStore((state) => state.setSearchQuery);
    const addTask = useStore((state) => state.addTask);
    const [sortOrder] = useSortOrder();

    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter, sortOrder });
    const empty = emptyState(selection, searchQuery);
    const listId = addListId(selection, lists);
    const canReorder = isReorderable(selection, searchQuery, sortOrder);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
            <GtkSearchBar
                searchModeEnabled={searchMode}
                onNotifySearchModeEnabled={(enabled) => setSearchMode(enabled ?? false)}
            >
                <GtkSearchEntry
                    placeholderText={t("Search tasks…")}
                    text={searchQuery}
                    onSearchChanged={(self) => setSearchQuery(self.text)}
                />
            </GtkSearchBar>
            <GtkScrolledWindow vexpand>
                <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                            <AdwEntryRow
                                title={t("Add a task…")}
                                onEntryActivated={(self) => {
                                    addTask(listId, self.text);
                                    self.text = "";
                                }}
                            />
                            {visible.map((task) => (
                                <TaskRow key={task.id} task={task} canReorder={canReorder} />
                            ))}
                        </GtkListBox>
                        {visible.length === 0 ? (
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
