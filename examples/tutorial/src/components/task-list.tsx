import { markupEscapeText } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { useTranslation } from "@gtkx/i18n";
import { AdwClamp, AdwEntryRow, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import type { Selection, Task } from "../types.js";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { useStore } from "../store/index.js";
import { addListId, emptyState, isReorderable, visibleTasks } from "../store/selectors.js";
import { TaskRow } from "./task-row.js";

const TaskSearch = () => {
    const { t } = useTranslation();
    const isSearchMode = useStore((state) => state.searchMode);
    const searchQuery = useStore((state) => state.searchQuery);
    const setSearchMode = useStore((state) => state.setSearchMode);
    const setSearchQuery = useStore((state) => state.setSearchQuery);

    return (
        <GtkSearchBar
            searchModeEnabled={isSearchMode}
            onNotifySearchModeEnabled={(enabled) => {
                setSearchMode(enabled ?? false);
            }}
        >
            <GtkSearchEntry
                placeholderText={t("Search tasks…")}
                text={searchQuery}
                onSearchChanged={(self) => {
                    setSearchQuery(self.text);
                }}
            />
        </GtkSearchBar>
    );
};

type TaskRowsProps = {
    tasks: Task[];
    canReorder: boolean;
    listId: string;
};

const TaskRows = ({ tasks, canReorder, listId }: TaskRowsProps) => {
    const { t } = useTranslation();
    const addTask = useStore((state) => state.addTask);

    return (
        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
            <AdwEntryRow
                title={t("Add a task…")}
                onEntryActivated={(self) => {
                    addTask(listId, self.text);
                    self.text = "";
                }}
            />
            {tasks.map((task, index) => (
                <TaskRow
                    key={task.id}
                    task={task}
                    canReorder={canReorder}
                    previousId={tasks[index - 1]?.id}
                    nextId={tasks[index + 1]?.id}
                />
            ))}
        </GtkListBox>
    );
};

const TaskCollection = ({ selection }: { selection: Selection }) => {
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const filter = useStore((state) => state.filter);
    const searchQuery = useStore((state) => state.searchQuery);
    const [sortOrder] = useSortOrder();

    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter, sortOrder });
    const empty = emptyState(selection, searchQuery);
    const listId = addListId(selection, lists);
    const canReorder = isReorderable(selection, searchQuery, filter, sortOrder);

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <TaskRows tasks={visible} canReorder={canReorder} listId={listId} />
                    {visible.length === 0
                        ? (
                                <AdwStatusPage
                                    cssClasses={["compact"]}
                                    iconName={empty.icon}
                                    title={empty.title}
                                    description={markupEscapeText(empty.description, -1)}
                                />
                            )
                        : null}
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};

const TaskList = ({ selection }: { selection: Selection }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
        <TaskSearch />
        <TaskCollection selection={selection} />
    </GtkBox>
);

export {
    TaskList,
};
