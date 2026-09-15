---
description: "Derive All Tasks, Today, Important, and Trash, count them, and filter and search the list."
---

# Smart Views, Filters, and Search

The adaptive layout from [A Layout That Collapses](/tutorial/an-adaptive-layout) is ready for more views. This chapter adds All Tasks, Today, Important, and Trash to the sidebar, then filters and searches the selected view. Each view derives from the existing tasks.

## A selection that is not always a list

Extend `Selection` to describe a smart view as well as a user list.

Add them to `src/types.ts`:

```diff
+export type SmartView = "all" | "today" | "important" | "trash";
+
-export type Selection = { kind: "list"; listId: string };
+export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };
+
+export type Filter = "all" | "open" | "done";
```

`Selection` remains the `Tasks` route's param type. Update the selected sidebar row, page title, and destination for new tasks to handle both variants. `Filter` will control the header's All, Open, and Done choices.

## Derived data belongs in a function

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
```

`selectionKey` gives a selection a single comparable string, so two selections match when their keys do. `addListId` answers the question a smart view raises. When you are looking at Today and type a new task, it joins the first list, since a task always belongs to exactly one list.

Append the predicates and `visibleTasks` to the same file:

```ts
// ...

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
```

Trash selects deleted tasks; the other views exclude them. The query searches titles and notes, and the filter selects completion state. Results retain the manual `position` order. Sorting by due date or title arrives in [Preferences and the System Theme](/tutorial/preferences-and-theming).

`isToday` is about dates rather than tasks, so it goes in `src/format.ts` beside `escapeMarkup`:

```ts
// ...

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const isToday = (iso: string | null): boolean => {
    if (!iso) return false;
    return startOfDay(new Date(iso)) === startOfDay(new Date());
};
```

Tasks store dates as ISO strings, so both sides are normalized to local midnight before the comparison. A task due at 6:00 PM and one due at 8:00 AM the same day are both due today.

## How to read derived data from the store

Components select the stable arrays and call these functions during render, with `selection` arriving as the prop the screen hands down from its params:

```tsx
const tasks = useStore((state) => state.tasks);
const lists = useStore((state) => state.lists);

const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
```

Keep the derived arrays outside these store selectors. Zustand requires stable selector results; its [computed selector guidance](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow) covers that constraint and `useShallow` when you need a computed selection.

## Counting what is still open

Add the counts to `src/store/selectors.ts`:

```ts
// ...

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
```

Every badge counts open work, so completing a task lowers it. Trash counts everything in it, because its badge answers whether anything is in there rather than whether anything is left to do.

## Putting the views in the sidebar

The sidebar no longer maps `lists` directly. It builds entries, with the smart views wrapped around the user's lists, each carrying the prefix it needs and the selection it navigates to.

Add the entry shape and its builder to the top of `src/components/sidebar.tsx`:

```tsx
// ...

type Entry = {
    selection: Selection;
    title: string;
    icon?: string;
    color?: string;
    count: number;
};

const buildEntries = (lists: TaskList[], counts: SidebarCounts): Entry[] => [
    { selection: { kind: "smart", view: "all" }, title: "All Tasks", icon: "view-list-symbolic", count: counts.all },
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
    { selection: { kind: "smart", view: "trash" }, title: "Trash", icon: "user-trash-symbolic", count: counts.trash },
];
```

Place Trash after the user's lists. These entries use symbolic icons from the system icon theme.

An entry carries the `Selection` it stands for, so the row that draws it and the `navigate` behind it read the same value.

The component reads the arrays, derives the entries, and finds the active row by key:

```tsx
// ...

export const Sidebar = ({ navigation }: SplitViewScreenProps<RootParamList, "Lists">) => {
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const selection = useSelection();

    const entries = buildEntries(lists, sidebarCounts(tasks, lists));
    const activeKey = selection === null ? null : selectionKey(selection);
    const activeIndex = entries.findIndex((entry) => selectionKey(entry.selection) === activeKey);

    // ...
};
```

When the content stack is empty, `activeIndex` is `-1`, so `selectedIndex` clears the native selection. Otherwise, selection keys match the current route to its sidebar row.

`onRowSelected` looks up an entry rather than a list, and navigates to whatever selection that entry carries:

```tsx
// ...

<GtkListBox
    cssClasses={["navigation-sidebar"]}
    selectedIndex={activeIndex}
    onRowSelected={(row) => {
        if (!row) return;
        const entry = entries[row.getIndex()];
        if (entry) {
            navigation.navigate("Tasks", entry.selection);
        }
    }}
>
```

Each row now picks its prefix and gets a badge:

```tsx
// ...

{entries.map((entry) => (
    <AdwActionRow
        key={selectionKey(entry.selection)}
        title={entry.title}
        prefix={
            entry.color ? (
                <GtkBox
                    valign={Gtk.Align.CENTER}
                    cssClasses={[listDot(entry.color)]}
                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                />
            ) : (
                <GtkImage iconName={entry.icon} />
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
```

`dimmed` makes the badge secondary to the title, and `numeric` gives its digits equal width. A zero count leaves the `suffix` slot empty.

The imports the file needs now:

```diff
 import * as Gtk from "@gtkx/gi/gtk";
 import { AdwActionRow } from "@gtkx/jsx/adw";
-import { GtkBox, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
+import { GtkBox, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
 import type { SplitViewScreenProps } from "@gtkx/navigation";
 import { type RootParamList, useSelection } from "../navigation.js";
 import { useStore } from "../store/index.js";
+import { type SidebarCounts, selectionKey, sidebarCounts } from "../store/selectors.js";
 import { listDot } from "../styles.js";
+import type { Selection, TaskList } from "../types.js";
```

The title the `Tasks` screen asks for takes the same treatment. In `src/components/window.tsx`:

```diff
+import { selectionTitle } from "../store/selectors.js";
@@
 options={({ route }) => ({
-    title: lists.find((list) => list.id === route.params.listId)?.name ?? "Tasks",
+    title: selectionTitle(route.params, lists),
 })}
```

Make All Tasks the initial route selection. Define it in `src/navigation.ts` so later commands can reuse it:

```diff
 export type RootParamList = {
     Lists: undefined;
     Tasks: Selection;
 };
+
+export const ALL_TASKS: Selection = { kind: "smart", view: "all" };
```

Then in `src/components/window.tsx`:

```diff
-import { Split } from "../navigation.js";
+import { ALL_TASKS, Split } from "../navigation.js";
```

```diff
-initialParams={{ kind: "list", listId: "personal" }}
+initialParams={ALL_TASKS}
```

## Filtering the visible list

The header filter narrows the selected view to all, open, or completed tasks.

Add it to the UI slice in `src/store/ui.ts`:

```diff
 export type UiSlice = {
     collapsed: boolean;
+    filter: Filter;
     setCollapsed: (collapsed: boolean) => void;
+    setFilter: (filter: Filter) => void;
 };
```

```diff
     collapsed: false,
+    filter: "all",
     setCollapsed: (collapsed) => set({ collapsed }),
+    setFilter: (filter) => set({ filter }),
```

Add `import type { Filter } from "../types.js";` to the imports.

Keep the filter in the UI slice, which persistence excludes, so every launch starts on All. The persistent sort preference comes later in [Preferences and the System Theme](/tutorial/preferences-and-theming).

Pass it through in `src/components/task-list.tsx`:

```diff
+const filter = useStore((state) => state.filter);
+
-const visible = tasks.filter((task) => !task.deleted && task.listId === selection.listId);
+const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
```

`searchQuery` is the other half of `VisibleOptions`, and it arrives two sections down. One call takes them together because a view, a filter, and a query narrow the same array, and the order they are applied in never matters.

## Widgets that live in a header bar

The screen's `options` accepts elements for its header slots. Give the filter its own component so it can subscribe to the store without adding a subscription to `Window`. Hooks belong in that component, not in the options callback.

Create `src/components/task-filter.tsx`:

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

`AdwToggleGroup` displays the named toggles as a segmented control. Pair `activeName` with `onNotifyActiveName` to keep the native selection and store filter in sync.

The handler narrows the native string value to one of the app's three filter names.

`headerTitle` puts a widget where the page title would be drawn. In `src/components/window.tsx`:

```diff
+import { TaskFilter } from "./task-filter.js";
@@
 options={({ route }) => ({
     title: selectionTitle(route.params, lists),
+    headerTitle: <TaskFilter />,
 })}
```

Keep `title` to name the page for navigation, even though the segmented control occupies its header title slot.

## Searching titles and notes

`matchesQuery` is already wired into `visibleTasks`. All that is missing is somewhere to type.

More fields in `src/store/ui.ts`:

```diff
     collapsed: boolean;
     filter: Filter;
+    searchMode: boolean;
+    searchQuery: string;
     setCollapsed: (collapsed: boolean) => void;
     setFilter: (filter: Filter) => void;
+    setSearchMode: (searchMode: boolean) => void;
+    setSearchQuery: (searchQuery: string) => void;
+    resetSearch: () => void;
```

```diff
     collapsed: false,
     filter: "all",
+    searchMode: false,
+    searchQuery: "",
     setCollapsed: (collapsed) => set({ collapsed }),
     setFilter: (filter) => set({ filter }),
+    setSearchMode: (searchMode) => set({ searchMode }),
+    setSearchQuery: (searchQuery) => set({ searchQuery }),
+    resetSearch: () => set({ searchMode: false, searchQuery: "" }),
```

`searchMode` is whether the bar is revealed, and `searchQuery` is what is in it. `resetSearch` clears both together, since switching views with a stale search still applied would show an empty pane for no visible reason.

Call `resetSearch` when the sidebar selects a view:

```tsx
// src/components/sidebar.tsx

    const resetSearch = useStore((state) => state.resetSearch); // [!code ++]

// ...

                onRowSelected={(row) => {
                    if (!row) return;
                    const entry = entries[row.getIndex()];
                    if (entry) {
                        resetSearch(); // [!code ++]
                        navigation.navigate("Tasks", entry.selection);
                    }
                }}
```

The selection handler clears the search and then navigates. Keeping those steps together avoids a separate screen effect for the same interaction.

The key does the other half, in `src/components/tasks-screen.tsx`:

```tsx
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { selectionKey } from "../store/selectors.js"; // [!code ++]
import { TaskList } from "./task-list.js";

export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => ( // [!code --]
    <TaskList selection={route.params} /> // [!code --]
); // [!code --]
export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => { // [!code ++]
    const selection = route.params; // [!code ++]
 // [!code ++]
    return <TaskList key={selectionKey(selection)} selection={selection} />; // [!code ++]
}; // [!code ++]
```

Navigating to a different selection updates the existing route's params. Keying `TaskList` by that selection gives each view a fresh scroll position and add row. See React's [state reset guidance](https://react.dev/learn/preserving-and-resetting-state#resetting-a-form-with-a-key) for how keys control this reset.

The bar itself goes above the scroller in `src/components/task-list.tsx`, so it pushes the list down rather than floating over it:

```tsx
// ...

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
        {/* ... */}
    </GtkScrolledWindow>
</GtkBox>
```

`GtkBox`, `GtkSearchBar`, and `GtkSearchEntry` join the import from `@gtkx/jsx/gtk`, and `searchMode`, `searchQuery`, and their two setters come off the store the way `filter` did.

`GtkSearchBar` handles native search dismissal, including Escape. Pair `searchModeEnabled` with `onNotifySearchModeEnabled` so closing the bar also updates the store.

Escape is also the key that leaves a page, which the navigator answers. The two do not collide: a key event reaches the focused widget first, so while you are typing in the search entry Escape closes the bar and travels no further. With the bar gone it is the page's key again, the one that took you back to the sidebar in [A Layout That Collapses](/tutorial/an-adaptive-layout).

`GtkSearchEntry` delays `search-changed` while typing, so the query follows GTK's search timing.

Keep the search button's store subscription in its own header component. Create `src/components/search-button.tsx`:

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

`headerStart` packs it at the leading end of the same bar. In `src/components/window.tsx`:

```diff
+import { SearchButton } from "./search-button.js";
@@
 options={({ route }) => ({
     title: selectionTitle(route.params, lists),
     headerTitle: <TaskFilter />,
+    headerStart: <SearchButton />,
 })}
```

The tooltip mentions a keyboard shortcut you build in [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts).

## When there is nothing to show

An empty pane can have different reasons behind it. A search with no results is not the same as an empty Trash, and the wording should say so.

Add the mapping to the end of `src/store/selectors.ts`:

```ts
// ...

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

A query outranks the view: when you searched and found nothing, the search is what you want explained. An empty user list borrows the All Tasks wording, since the advice is the same.

Render it below the list box in `src/components/task-list.tsx`, inside a vertical box so they stack inside the clamp:

```tsx
// ...

<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
    <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
        {/* ... */}
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
```

`AdwStatusPage` is the component that filled the window in [Your First Window](/tutorial/your-first-window) and fills the content pane when nothing is selected. The `compact` style class shrinks its icon and type scale so it reads as a note under a card rather than the whole screen. The card stays mounted above it, because the add row lives in it and typing a task is what you most want to do from an empty view.

The task list derives its values at the top of the component, with `lists` joining the arrays it selects, since `addListId` needs it:

```tsx
// ...

const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
const empty = emptyState(selection, searchQuery);
const listId = addListId(selection, lists);
```

`listId` is the last of the expressions the union broke. The add row still reads `selection.listId`, which no longer type-checks and would file the task under the wrong list from a smart view, so point it at the derived value:

```diff
 <AdwEntryRow
     title="Add a task…"
     onEntryActivated={(self) => {
-        addTask(selection.listId, self.text);
+        addTask(listId, self.text);
         self.text = "";
     }}
 />
```

## Run it

Save, and the sidebar in the open window redraws: All Tasks, Today, Important, your lists, and Trash, each with a count of open work on the right.

- Tick **Water the plants**. The badges on All Tasks, Today, Important, and Personal all drop by one at once.
- Click **Today**. Only tasks due today are listed. Click **Trash**, and the task you deleted earlier is there, with a badge counting it.
- Set the header filter to **Done**, and the list narrows to completed tasks. Set it to **Open** and they disappear. Switch to another view and the filter stays where you put it.
- Click the search button and type `report`. The list narrows as you type. Type `zzz`: the card empties and the note reads **No Results**, with your query quoted back.
- With the search still open, click another view in the sidebar. Its selection handler closes the bar and clears the query. Click **Trash** with nothing in it and the note reads **Trash Is Empty** instead.

Leave the filter on **Done**, then restart the app. It returns to **All** because the UI slice is excluded from persistence. Navigation state is also temporary in this app, so the selected view returns to All Tasks.

## Checkpoint

The complete `src/store/selectors.ts`:

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

## Next

[Opening a Task](/tutorial/the-task-editor) gives a task a page of its own on the content stack, where it gains notes, a due date picked from a calendar, and an Important switch.
