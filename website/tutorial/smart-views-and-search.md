---
description: "Add smart views, a native filter control, and a search bar to the task list."
---

# Smart Views, Filters, and Search

The split view now adapts to a narrow window. Add All Tasks, Today, Important, and Trash to its sidebar, then filter and search the selected view.

## Extend the selection

In `src/types.ts`, replace `Selection` and add `SmartView` and `Filter`:

```ts
export type SmartView = "all" | "today" | "important" | "trash";

export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };

export type Filter = "all" | "open" | "done";
```

`Selection` remains the `Tasks` route's param type. A smart view combines tasks from any list.

## Derive the visible tasks

Create `src/format.ts` for the shared date helper:

```ts
const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const isToday = (iso: string | null): boolean => {
    if (!iso) return false;
    return startOfDay(new Date(iso)) === startOfDay(new Date());
};
```

Create `src/store/selectors.ts`:

```ts
import { isToday } from "../format.js";
import type { Filter, Selection, SmartView, Task, TaskList } from "../types.js";

const SMART_TITLES: Record<SmartView, string> = {
    all: "All Tasks",
    today: "Today",
    important: "Important",
    trash: "Trash",
};

export const selectionKey = (selection: Selection): string =>
    selection.kind === "smart" ? `smart:${selection.view}` : `list:${selection.listId}`;

export const selectionTitle = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list"
        ? (lists.find((list) => list.id === selection.listId)?.name ?? "Tasks")
        : SMART_TITLES[selection.view];

export const addListId = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list" ? selection.listId : (lists[0]?.id ?? "");

const inSelection = (task: Task, selection: Selection): boolean => {
    if (selection.kind === "list") return !task.deleted && task.listId === selection.listId;
    switch (selection.view) {
        case "all":
            return !task.deleted;
        case "today":
            return !task.deleted && isToday(task.due);
        case "important":
            return !task.deleted && task.important;
        case "trash":
            return task.deleted;
    }
};

const matchesQuery = (task: Task, query: string): boolean => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return task.title.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle);
};

const matchesFilter = (task: Task, filter: Filter): boolean => {
    if (filter === "open") return !task.done;
    if (filter === "done") return task.done;
    return true;
};

export type VisibleOptions = { query: string; filter: Filter };

export const visibleTasks = (tasks: Task[], selection: Selection, options: VisibleOptions): Task[] =>
    tasks
        .filter(
            (task) =>
                inSelection(task, selection) &&
                matchesQuery(task, options.query) &&
                matchesFilter(task, options.filter),
        )
        .sort((a, b) => a.position - b.position);

export type SidebarCounts = {
    all: number;
    today: number;
    important: number;
    trash: number;
    lists: Record<string, number>;
};

export const sidebarCounts = (tasks: Task[], lists: TaskList[]): SidebarCounts => {
    const open = tasks.filter((task) => !task.deleted && !task.done);
    return {
        all: open.length,
        today: open.filter((task) => isToday(task.due)).length,
        important: open.filter((task) => task.important).length,
        trash: tasks.filter((task) => task.deleted).length,
        lists: Object.fromEntries(
            lists.map((list) => [list.id, open.filter((task) => task.listId === list.id).length]),
        ),
    };
};

export type EmptyState = { icon: string; title: string; description: string };

const SMART_EMPTY: Record<SmartView, EmptyState> = {
    all: { icon: "view-list-symbolic", title: "No Tasks Yet", description: "Add a task above to get started" },
    today: {
        icon: "x-office-calendar-symbolic",
        title: "Nothing Due Today",
        description: "Tasks due today appear here",
    },
    important: { icon: "starred-symbolic", title: "No Important Tasks", description: "Star a task to find it here" },
    trash: { icon: "user-trash-symbolic", title: "Trash Is Empty", description: "Deleted tasks appear here" },
};

export const emptyState = (selection: Selection, query: string): EmptyState => {
    if (query) return { icon: "system-search-symbolic", title: "No Results", description: `No tasks match “${query}”` };
    if (selection.kind === "smart") return SMART_EMPTY[selection.view];
    return SMART_EMPTY.all;
};
```

Trash includes deleted tasks; the other views exclude them. Sidebar badges count open tasks, except Trash, which counts everything it contains. New tasks created from a smart view go into the first list.

Components will select the stored arrays and derive their visible rows during render. For other selector patterns, see [Zustand's guide](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow).

## Add the filter and search state

Replace `src/store/ui.ts` with:

```ts
import type { StateCreator } from "zustand";
import type { Filter } from "../types.js";
import type { Mutators, Store } from "./index.js";

export type UiSlice = {
    collapsed: boolean;
    filter: Filter;
    searchMode: boolean;
    searchQuery: string;
    setCollapsed: (collapsed: boolean) => void;
    setFilter: (filter: Filter) => void;
    setSearchMode: (searchMode: boolean) => void;
    setSearchQuery: (searchQuery: string) => void;
    resetSearch: () => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    collapsed: false,
    filter: "all",
    searchMode: false,
    searchQuery: "",
    setCollapsed: (collapsed) => set({ collapsed }),
    setFilter: (filter) => set({ filter }),
    setSearchMode: (searchMode) => set({ searchMode }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    resetSearch: () => set({ searchMode: false, searchQuery: "" }),
});
```

The UI slice is already excluded by `partialize`, so the filter and search start fresh on each launch. Choosing a sidebar entry calls `resetSearch` before navigating.

## Update the sidebar

Replace `src/components/sidebar.tsx` with:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { type RootParamList, useSelection } from "../navigation.js";
import { useStore } from "../store/index.js";
import { type SidebarCounts, selectionKey, sidebarCounts } from "../store/selectors.js";
import { listDot } from "../styles.js";
import type { Selection, TaskList } from "../types.js";

type Entry = {
    selection: Selection;
    title: string;
    icon?: string;
    color?: string;
    count: number;
};

const buildEntries = (lists: TaskList[], counts: SidebarCounts): Entry[] => [
    {
        selection: { kind: "smart", view: "all" },
        title: "All Tasks",
        icon: "view-list-symbolic",
        count: counts.all,
    },
    {
        selection: { kind: "smart", view: "today" },
        title: "Today",
        icon: "x-office-calendar-symbolic",
        count: counts.today,
    },
    {
        selection: { kind: "smart", view: "important" },
        title: "Important",
        icon: "starred-symbolic",
        count: counts.important,
    },
    ...lists.map(
        (list): Entry => ({
            selection: { kind: "list", listId: list.id },
            title: list.name,
            color: list.color,
            count: counts.lists[list.id] ?? 0,
        }),
    ),
    {
        selection: { kind: "smart", view: "trash" },
        title: "Trash",
        icon: "user-trash-symbolic",
        count: counts.trash,
    },
];

export const Sidebar = ({ navigation }: SplitViewScreenProps<RootParamList, "Lists">) => {
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const resetSearch = useStore((state) => state.resetSearch);
    const selection = useSelection();

    const entries = buildEntries(lists, sidebarCounts(tasks, lists));
    const activeKey = selection === null ? null : selectionKey(selection);
    const activeIndex = entries.findIndex((entry) => selectionKey(entry.selection) === activeKey);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListBox
                cssClasses={["navigation-sidebar"]}
                selectedIndex={activeIndex}
                onRowSelected={(row) => {
                    if (!row) return;
                    const entry = entries[row.getIndex()];
                    if (entry) {
                        resetSearch();
                        navigation.navigate("Tasks", entry.selection);
                    }
                }}
            >
                {entries.map((entry) => (
                    <AdwActionRow
                        key={selectionKey(entry.selection)}
                        title={entry.title}
                        useMarkup={false}
                        prefix={
                            entry.color ? (
                                <GtkBox
                                    valign={Gtk.Align.CENTER}
                                    cssClasses={[listDot(entry.color)]}
                                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                                />
                            ) : (
                                <GtkImage iconName={entry.icon} accessibleRole={Gtk.AccessibleRole.PRESENTATION} />
                            )
                        }
                        suffix={
                            entry.count > 0 ? (
                                <GtkLabel valign={Gtk.Align.CENTER} cssClasses={["dimmed", "numeric"]}>
                                    {String(entry.count)}
                                </GtkLabel>
                            ) : undefined
                        }
                    />
                ))}
            </GtkListBox>
        </GtkScrolledWindow>
    );
};
```

Each row carries the selection it opens. `selectedIndex` continues to follow the route, now comparing selection keys instead of list IDs. Empty badges are omitted.

In `src/navigation.ts`, add the launch selection:

```ts
export const ALL_TASKS: Selection = { kind: "smart", view: "all" };
```

In `src/components/window.tsx`, import it and the title helper:

```ts
import { ALL_TASKS, Split } from "../navigation.js";
import { selectionTitle } from "../store/selectors.js";
```

Use `initialParams={ALL_TASKS}` on the `Tasks` screen. Its title now comes from `selectionTitle(route.params, lists)`; the complete options appear below.

## Put controls in the header

A header control can be a component with its own store subscription. Create `src/components/task-filter.tsx`:

```tsx
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { useStore } from "../store/index.js";

export const TaskFilter = () => {
    const filter = useStore((state) => state.filter);
    const setFilter = useStore((state) => state.setFilter);

    return (
        <AdwToggleGroup
            activeName={filter}
            cssClasses={["round"]}
            onNotifyActiveName={(name) => {
                if (name === "all" || name === "open" || name === "done") setFilter(name);
            }}
        >
            <AdwToggle name="all" label="All" />
            <AdwToggle name="open" label="Open" />
            <AdwToggle name="done" label="Done" />
        </AdwToggleGroup>
    );
};
```

GTKX's notify props receive the property value first. The native toggle name is a nullable string, so the handler accepts only the app's three filter names.

Create `src/components/search-button.tsx`:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";

export const SearchButton = () => {
    const searchMode = useStore((state) => state.searchMode);
    const setSearchMode = useStore((state) => state.setSearchMode);

    return (
        <GtkButton
            iconName="system-search-symbolic"
            tooltipText="Search (Ctrl+F)"
            onClicked={() => setSearchMode(!searchMode)}
        />
    );
};
```

The shortcut in the tooltip is added in [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts).

In `src/components/window.tsx`, import both controls:

```ts
import { SearchButton } from "./search-button.js";
import { TaskFilter } from "./task-filter.js";
```

Replace the `Tasks` screen declaration with:

```tsx
<Split.Screen
    name="Tasks"
    component={TasksScreen}
    initialParams={ALL_TASKS}
    options={({ route }) => ({
        title: selectionTitle(route.params, lists),
        headerTitle: <TaskFilter />,
        headerStart: <SearchButton />,
    })}
/>
```

`headerTitle` replaces the visible title widget. Keep `title` as well: it names the native navigation page and is used for back navigation.

## Render search and empty states

Replace `src/components/task-list.tsx` with:

```tsx
import { markupEscapeText } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp, AdwEntryRow, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import type { Selection } from "../types.js";
import { useStore } from "../store/index.js";
import { addListId, emptyState, visibleTasks } from "../store/selectors.js";
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

    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
    const empty = emptyState(selection, searchQuery);
    const listId = addListId(selection, lists);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
            <GtkSearchBar
                searchModeEnabled={searchMode}
                onNotifySearchModeEnabled={(enabled) => setSearchMode(enabled ?? false)}
            >
                <GtkSearchEntry
                    placeholderText="Search tasks…"
                    text={searchQuery}
                    onSearchChanged={(self) => setSearchQuery(self.text)}
                />
            </GtkSearchBar>
            <GtkScrolledWindow vexpand>
                <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
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
                                description={markupEscapeText(empty.description, -1)}
                            />
                        ) : null}
                    </GtkBox>
                </AdwClamp>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
```

`GtkSearchBar` owns the search entry and handles dismissal with Escape. Its notify handler keeps that dismissal in the store. `GtkSearchEntry.onSearchChanged` reports edits after the native search delay.

`AdwStatusPage.description` accepts Pango markup. Escape the generated message with GLib's `markupEscapeText` so queries containing `&`, `<`, or markup tags appear literally. The add row stays available when no tasks match.

Replace `src/components/tasks-screen.tsx` with:

```tsx
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { selectionKey } from "../store/selectors.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => (
    <TaskList key={selectionKey(route.params)} selection={route.params} />
);
```

Changing the selection remounts the native list, clearing its scroll position and unfinished add-row text. React explains [state reset through keys](https://react.dev/learn/preserving-and-resetting-state).

## Run it

Save the files and restart the app to see All Tasks as the launch view.

- Complete an open task and check the sidebar counts.
- Select Today, Important, and Trash. Each shows tasks matching that view.
- Switch the header filter between All, Open, and Done.
- Search for `report`, then `<b>missing</b> & café`. The empty-state message should show the second query literally.
- Choose another sidebar entry. Its handler clears the query and closes the search bar.

Quit and restart once more. Tasks are preserved; the filter returns to All and search is closed.

## Next

Continue to [Opening a Task](/tutorial/the-task-editor).
