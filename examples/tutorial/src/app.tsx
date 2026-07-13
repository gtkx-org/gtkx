import * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwBreakpoint,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToastOverlay,
    AdwToggle,
    AdwToggleGroup,
    AdwToolbarView,
    AdwWindowTitle,
} from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import {
    GtkActionBar,
    GtkBox,
    GtkButton,
    GtkMenuButton,
    GtkPopover,
    GtkShortcut,
    GtkShortcutController,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { quit, useApplication, useBindSetting, useSetting } from "@gtkx/react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
import { About } from "./components/about.js";
import { DeleteConfirmation } from "./components/delete-confirmation.js";
import { MainMenu } from "./components/main-menu.js";
import { NewListDialog } from "./components/new-list-dialog.js";
import { Preferences } from "./components/preferences.js";
import { SelectionView } from "./components/selection-view.js";
import { Shortcuts } from "./components/shortcuts.js";
import { Sidebar } from "./components/sidebar.js";
import { TaskDetail } from "./components/task-detail.js";
import { TaskList } from "./components/task-list.js";
import type { TaskRowHandlers } from "./components/task-row.js";
import { useReminders } from "./hooks/use-reminders.js";
import { useTasks } from "./hooks/use-tasks.js";
import { buildReminder } from "./notifications.js";
import { type Filter, sidebarCounts, visibleTasks } from "./select.js";
import { applyColorScheme } from "./theme.js";
import type { Selection, SmartView, Task, TaskList as TaskListType } from "./types.js";

const SMART_TITLES: Record<SmartView, string> = {
    all: "All Tasks",
    today: "Today",
    important: "Important",
    trash: "Trash",
};

const titleFor = (selection: Selection, lists: TaskListType[]): string =>
    selection.kind === "list"
        ? (lists.find((list) => list.id === selection.listId)?.name ?? "Tasks")
        : SMART_TITLES[selection.view];

type EmptyState = { icon: string; title: string; description: string };

const emptyFor = (selection: Selection, query: string): EmptyState => {
    if (query) return { icon: "system-search-symbolic", title: "No Results", description: `No tasks match “${query}”` };
    if (selection.kind === "smart" && selection.view === "trash")
        return { icon: "user-trash-symbolic", title: "Trash Is Empty", description: "Deleted tasks appear here" };
    if (selection.kind === "smart" && selection.view === "today")
        return {
            icon: "x-office-calendar-symbolic",
            title: "Nothing Due Today",
            description: "Tasks due today appear here",
        };
    if (selection.kind === "smart" && selection.view === "important")
        return { icon: "starred-symbolic", title: "No Important Tasks", description: "Star a task to find it here" };
    return { icon: "view-list-symbolic", title: "No Tasks Yet", description: "Add a task above to get started" };
};

const FilterToggle = ({ filter, onChange }: { filter: Filter; onChange: (value: Filter) => void }) => (
    <AdwToggleGroup
        activeName={filter}
        cssClasses={["round"]}
        onNotifyActiveName={(name) => {
            if (name === "all" || name === "open" || name === "done") onChange(name);
        }}
    >
        <AdwToggle name="all" label="All" />
        <AdwToggle name="open" label="Open" />
        <AdwToggle name="done" label="Done" />
    </AdwToggleGroup>
);

const WindowActions = ({
    onNew,
    onSelect,
    onPreferences,
    onShortcuts,
    onAbout,
}: {
    onNew: () => void;
    onSelect: () => void;
    onPreferences: () => void;
    onShortcuts: () => void;
    onAbout: () => void;
}) => (
    <>
        <GSimpleAction name="new" onActivate={onNew} />
        <GSimpleAction name="select" onActivate={onSelect} />
        <GSimpleAction name="preferences" onActivate={onPreferences} />
        <GSimpleAction name="shortcuts" onActivate={onShortcuts} />
        <GSimpleAction name="about" onActivate={onAbout} />
    </>
);

const makeShortcut = (accelerator: string, run: () => void, enabled: boolean) => (
    <GtkShortcut
        trigger={enabled ? Gtk.ShortcutTrigger.parseString(accelerator) : Gtk.NeverTrigger.get()}
        action={Gtk.CallbackAction.new(() => {
            run();
            return true;
        })}
    />
);

const AppShortcuts = ({
    onSearch,
    onEscape,
    escapeEnabled,
    onDelete,
    deleteEnabled,
}: {
    onSearch: () => void;
    onEscape: () => void;
    escapeEnabled: boolean;
    onDelete: () => void;
    deleteEnabled: boolean;
}) => (
    <GtkShortcutController
        scope={Gtk.ShortcutScope.GLOBAL}
        shortcuts={
            <>
                {makeShortcut("<Control>f", onSearch, true)}
                {makeShortcut("Escape", onEscape, escapeEnabled)}
                {makeShortcut("Delete", onDelete, deleteEnabled)}
            </>
        }
    />
);

type NotifyHandlers = { complete: (id: string) => void; open: (id: string) => void };

function TasksWindow({ notify }: { notify: RefObject<NotifyHandlers> }) {
    const api = useTasks();
    const { lists, tasks } = api;
    const app = useApplication();

    const [selection, setSelection] = useState<Selection>({ kind: "smart", view: "all" });
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [collapsed, setCollapsed] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showNewList, setShowNewList] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [selecting, setSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [filter, setFilter] = useSetting(schema, "filter");
    const [sortOrder] = useSetting(schema, "sort-order");
    const [colorScheme] = useSetting(schema, "color-scheme");
    const [reminderMinutes] = useSetting(schema, "reminder-minutes");
    const windowRef = useRef<Adw.ApplicationWindow | null>(null);
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

    useBindSetting(schema, "window-width", windowRef, "defaultWidth");
    useBindSetting(schema, "window-height", windowRef, "defaultHeight");

    useEffect(() => {
        applyColorScheme(colorScheme);
    }, [colorScheme]);

    const counts = sidebarCounts(tasks, lists);
    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter, sortOrder });
    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
    const addListId = selection.kind === "list" ? selection.listId : (lists[0]?.id ?? "");
    const reorderable =
        sortOrder === "manual" && !searchQuery && !(selection.kind === "smart" && selection.view === "trash");

    notify.current = {
        complete: (id) => api.setDone(id, true),
        open: (id) => {
            setSelection({ kind: "smart", view: "all" });
            setSelectedTaskId(id);
            if (collapsed) setShowContent(true);
        },
    };

    const sendReminder = useCallback((task: Task) => app.sendNotification(task.id, buildReminder(task)), [app]);
    useReminders(tasks, reminderMinutes, sendReminder);

    const openTask = (id: string): void => {
        setSelectedTaskId(id);
        if (collapsed) setShowContent(true);
    };

    const selectSidebar = (next: Selection): void => {
        setSelection(next);
        setSelectedTaskId(null);
        setSearchQuery("");
        setSearchMode(false);
        setSelecting(false);
        setSelectedIds([]);
        if (collapsed) setShowContent(true);
    };

    const newTask = (): void => {
        const id = api.addTask(addListId, "New Task");
        if (id) openTask(id);
    };

    const handleDelete = (task: Task): void => {
        if (task.deleted) {
            setTaskToDelete(task);
            return;
        }
        api.moveToTrash(task.id);
        if (selectedTaskId === task.id) setSelectedTaskId(null);
        const toast = Adw.Toast.new(`“${task.title}” moved to Trash`);
        toast.buttonLabel = "Undo";
        toast.once("button-clicked", () => api.restore(task.id));
        toastOverlayRef.current?.addToast(toast);
    };

    const confirmDelete = (): void => {
        if (!taskToDelete) return;
        api.deleteForever(taskToDelete.id);
        if (selectedTaskId === taskToDelete.id) setSelectedTaskId(null);
        setTaskToDelete(null);
    };

    const enterSelection = (): void => {
        setSelectedTaskId(null);
        setSelectedIds([]);
        setSelecting(true);
    };
    const cancelSelection = (): void => {
        setSelecting(false);
        setSelectedIds([]);
    };
    const completeSelected = (): void => {
        api.completeMany(selectedIds);
        cancelSelection();
    };
    const moveSelected = (listId: string): void => {
        api.moveToList(selectedIds, listId);
        cancelSelection();
    };
    const deleteSelected = (): void => {
        const ids = [...selectedIds];
        api.trashMany(ids);
        const toast = Adw.Toast.new(`${ids.length} task${ids.length === 1 ? "" : "s"} moved to Trash`);
        toast.buttonLabel = "Undo";
        toast.once("button-clicked", () => {
            for (const id of ids) api.restore(id);
        });
        toastOverlayRef.current?.addToast(toast);
        cancelSelection();
    };

    const rowHandlers: TaskRowHandlers = {
        onToggleDone: (id, done) => api.setDone(id, done),
        onToggleImportant: (id, important) => api.setImportant(id, important),
        onDelete: handleDelete,
        onOpen: openTask,
        onReorder: (draggedId, targetId) => api.reorder(draggedId, targetId),
    };

    const handleClose = (): boolean => {
        api.flush();
        return quit();
    };

    const detailHeader = selectedTask ? (
        <AdwHeaderBar
            start={
                <GtkButton
                    iconName="go-previous-symbolic"
                    tooltipText="Back"
                    onClicked={() => setSelectedTaskId(null)}
                />
            }
            end={
                <>
                    <GtkToggleButton
                        iconName={selectedTask.important ? "starred-symbolic" : "non-starred-symbolic"}
                        active={selectedTask.important}
                        tooltipText="Important"
                        onToggled={(self) => api.setImportant(selectedTask.id, self.active)}
                    />
                    <GtkButton
                        iconName="user-trash-symbolic"
                        tooltipText="Delete (Delete)"
                        onClicked={() => handleDelete(selectedTask)}
                    />
                </>
            }
        />
    ) : null;

    const listHeader = (
        <AdwHeaderBar
            titleWidget={<FilterToggle filter={filter} onChange={setFilter} />}
            start={
                <>
                    <GtkButton iconName="list-add-symbolic" tooltipText="New Task (Ctrl+N)" onClicked={newTask} />
                    <GtkButton
                        iconName="system-search-symbolic"
                        tooltipText="Search (Ctrl+F)"
                        onClicked={() => setSearchMode((mode) => !mode)}
                    />
                </>
            }
            end={<MainMenu />}
        />
    );

    const selectionHeader = (
        <AdwHeaderBar
            showStartTitleButtons={false}
            showEndTitleButtons={false}
            titleWidget={<AdwWindowTitle title={`${selectedIds.length} selected`} />}
            start={<GtkButton label="Cancel" onClicked={cancelSelection} />}
            end={<GtkButton label="Select All" onClicked={() => setSelectedIds(visible.map((task) => task.id))} />}
        />
    );

    const selectionActionBar = (
        <GtkActionBar
            revealed={selecting}
            start={
                <GtkButton
                    label="Complete"
                    cssClasses={["suggested-action"]}
                    sensitive={selectedIds.length > 0}
                    onClicked={completeSelected}
                />
            }
            end={
                <>
                    <GtkMenuButton
                        label="Move"
                        sensitive={selectedIds.length > 0}
                        popover={
                            <GtkPopover>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                                    {lists.map((list) => (
                                        <GtkButton
                                            key={list.id}
                                            label={list.name}
                                            cssClasses={["flat"]}
                                            onClicked={() => moveSelected(list.id)}
                                        />
                                    ))}
                                </GtkBox>
                            </GtkPopover>
                        }
                    />
                    <GtkButton
                        label="Delete"
                        cssClasses={["destructive-action"]}
                        sensitive={selectedIds.length > 0}
                        onClicked={deleteSelected}
                    />
                </>
            }
        />
    );

    const contentBody = selectedTask ? (
        <TaskDetail
            key={selectedTask.id}
            task={selectedTask}
            onUpdate={(fields) => api.updateTask(selectedTask.id, fields)}
            onSetImportant={(important) => api.setImportant(selectedTask.id, important)}
        />
    ) : selecting ? (
        <SelectionView tasks={visible} selectedIds={selectedIds} onSelectionChanged={setSelectedIds} />
    ) : (
        <TaskList
            tasks={visible}
            reorderable={reorderable}
            addPlaceholder="Add a task…"
            onAddTask={(title) => api.addTask(addListId, title)}
            empty={emptyFor(selection, searchQuery)}
            search={{
                mode: searchMode,
                onModeChange: setSearchMode,
                query: searchQuery,
                onQueryChange: setSearchQuery,
            }}
            row={rowHandlers}
        />
    );

    const topBar = detailHeader ?? (selecting ? selectionHeader : listHeader);

    return (
        <AdwApplicationWindow
            ref={windowRef}
            title="Tasks"
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={handleClose}
            breakpoints={
                <AdwBreakpoint
                    condition={Adw.BreakpointCondition.parse("max-width: 500sp")}
                    onApply={() => setCollapsed(true)}
                    onUnapply={() => setCollapsed(false)}
                />
            }
            actions={
                <WindowActions
                    onNew={newTask}
                    onSelect={enterSelection}
                    onPreferences={() => setShowPreferences(true)}
                    onShortcuts={() => setShowShortcuts(true)}
                    onAbout={() => setShowAbout(true)}
                />
            }
            controllers={
                <AppShortcuts
                    onSearch={() => setSearchMode((mode) => !mode)}
                    onEscape={() => {
                        if (selecting) cancelSelection();
                        else setSelectedTaskId(null);
                    }}
                    escapeEnabled={selectedTask !== null || selecting}
                    onDelete={() => {
                        if (selectedTask) handleDelete(selectedTask);
                    }}
                    deleteEnabled={selectedTask !== null}
                />
            }
        >
            <AdwToastOverlay ref={toastOverlayRef}>
                <AdwNavigationSplitView
                    collapsed={collapsed}
                    showContent={showContent}
                    onNotifyShowContent={(value) => setShowContent(value ?? false)}
                    sidebarWidthFraction={0.25}
                    minSidebarWidth={220}
                    maxSidebarWidth={300}
                    sidebar={
                        <AdwNavigationPage title="Tasks">
                            <AdwToolbarView
                                topBar={
                                    <AdwHeaderBar
                                        start={
                                            <GtkButton
                                                iconName="list-add-symbolic"
                                                tooltipText="New List"
                                                onClicked={() => setShowNewList(true)}
                                            />
                                        }
                                    />
                                }
                            >
                                <Sidebar lists={lists} counts={counts} selection={selection} onSelect={selectSidebar} />
                            </AdwToolbarView>
                        </AdwNavigationPage>
                    }
                    content={
                        <AdwNavigationPage title={titleFor(selection, lists)}>
                            <AdwToolbarView
                                topBar={topBar}
                                bottomBar={selecting ? selectionActionBar : undefined}
                                revealBottomBars={selecting}
                            >
                                {contentBody}
                            </AdwToolbarView>
                        </AdwNavigationPage>
                    }
                />
            </AdwToastOverlay>

            {showPreferences ? <Preferences onClose={() => setShowPreferences(false)} /> : null}
            {showAbout ? <About onClose={() => setShowAbout(false)} /> : null}
            {showShortcuts ? <Shortcuts onClose={() => setShowShortcuts(false)} /> : null}
            {showNewList ? (
                <NewListDialog
                    onAdd={(name, color) => {
                        api.addList(name, color);
                        setShowNewList(false);
                    }}
                    onCancel={() => setShowNewList(false)}
                />
            ) : null}
            {taskToDelete ? (
                <DeleteConfirmation
                    taskTitle={taskToDelete.title}
                    onConfirm={confirmDelete}
                    onCancel={() => setTaskToDelete(null)}
                />
            ) : null}
        </AdwApplicationWindow>
    );
}

export function App() {
    const notify = useRef<NotifyHandlers>({ complete: () => {}, open: () => {} });
    return (
        <AdwApplication
            actionAccels={[
                { detailedActionName: "win.new", accels: ["<Control>n"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
            ]}
        >
            <GSimpleAction
                name="complete-task"
                parameterType={GLib.VariantType.new("s")}
                onActivate={(parameter) => {
                    if (parameter) notify.current.complete(parameter.getString()[0]);
                }}
            />
            <GSimpleAction
                name="open-task"
                parameterType={GLib.VariantType.new("s")}
                onActivate={(parameter) => {
                    if (parameter) notify.current.open(parameter.getString()[0]);
                }}
            />
            <TasksWindow notify={notify} />
        </AdwApplication>
    );
}
