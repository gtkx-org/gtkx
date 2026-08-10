---
description: "Derive All Tasks, Today, Important, and Trash, count them, and filter and search the list."
---

# Smart Views, Filters, and Search

In [A Layout That Collapses](/tutorial/an-adaptive-layout) you made the window collapse to a single pane on a narrow screen and reopen as two when there is room.

The sidebar reaches a list, but not everything due today, everything you starred, or everything you deleted. None of that needs new state. A task already carries `due`, `important`, and `deleted`, so each view is a filter over the array you have.

## A selection that is not always a list

`Selection` had one shape, so the sidebar could compare `selection.listId` and be done. A smart view is a selection with no list behind it, so the union gets a second variant.

Add both to `src/types.ts`:

```diff
+export type SmartView = "all" | "today" | "important" | "trash";
+
-export type Selection = { kind: "list"; listId: string };
+export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };
+
+export type Filter = "all" | "open" | "done";
```

`Filter` goes in the same edit because the header gets a filter later on this page.

That breaks every expression that read `selection.listId`: the active sidebar row, the content page title, and the list a new task joins. Each has to handle both variants now. These are questions about your data, not a component's job.

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

The independent checks compose into one visible list. Trash is the only view that shows deleted tasks, so it is the only one that ignores the `deleted` flag instead of excluding on it. The `switch` has no `default` branch on purpose: add a smart view to the union and TypeScript reports that this function no longer returns on every path, so you find out at compile time.

`.filter` returns a fresh array, so sorting it in place is safe. Position is the manual order a task carries. Sorting by due date or title arrives with the preferences in [Preferences and the System Theme](/tutorial/preferences-and-theming).

`isToday` is about dates rather than tasks, so it goes in `src/format.ts` beside `escapeMarkup`:

```ts
// ...

const startOfDay = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const isToday = (iso: string | null): boolean => {
    if (!iso) return false;
    return startOfDay(new Date(iso)) === startOfDay(new Date());
};
```

Tasks store dates as ISO strings, so both sides are normalized to local midnight before the comparison. A task due at 6:00 PM and one due at 8:00 AM the same day are both due today.

## How to read derived data from the store

Components select the stable arrays and call these functions during render:

```tsx
const tasks = useStore((state) => state.tasks);
const lists = useStore((state) => state.lists);

const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
```

Do not move that work into the selector. A selector runs on every store change, and zustand compares its result with `Object.is` to decide whether to re-render. `state.tasks` is the same array object until something writes to it, so the comparison holds. A selector that builds a fresh array or object never compares equal to its previous result, so the component re-renders on every change to any part of the store.

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

The sidebar no longer maps `lists` directly. It builds entries, with the smart views wrapped around the user's lists, each carrying the prefix it needs.

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

Trash sits last because that is where GNOME puts it. The icon names are standard symbolic ones your icon theme already ships, so they need no assets from you.

The component reads the arrays, derives the entries, and finds the active row by key:

```tsx
// ...

export const Sidebar = () => {
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const selection = useStore((state) => state.selection);
    const select = useStore((state) => state.select);

    const entries = buildEntries(lists, sidebarCounts(tasks, lists));
    const activeIndex = entries.findIndex((entry) => selectionKey(entry.selection) === selectionKey(selection));
    const listRef = useRef<Gtk.ListBox | null>(null);

    useEffect(() => {
        const box = listRef.current;
        if (!box || activeIndex < 0) return;
        const row = box.getRowAtIndex(activeIndex);
        if (row) box.selectRow(row);
    }, [activeIndex]);

    // ...
};
```

That effect and its early-return guard are the same sync between GTK4's own selection and the store that you wrote in [Lists and a Sidebar](/tutorial/lists-and-the-sidebar). Only the comparison changed: keys instead of list ids.

The row's `onRowSelected` compares by key for the same reason:

```tsx
// ...

<GtkListBox
    ref={listRef}
    cssClasses={["navigation-sidebar"]}
    onRowSelected={(row) => {
        if (!row) return;
        const entry = entries[row.getIndex()];
        if (entry && selectionKey(entry.selection) !== selectionKey(selection)) select(entry.selection);
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

`dimmed` mutes the badge against the row title, since a count is secondary. `numeric` asks the font for tabular figures, where every digit takes the same width, so a badge going from 9 to 10 to 9 does not make the row jitter. A count of zero renders no badge: a slot given `undefined` mounts nothing.

The imports the file needs now:

```diff
 import * as Gtk from "@gtkx/gi/gtk";
 import { AdwActionRow } from "@gtkx/jsx/adw";
-import { GtkBox, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
+import { GtkBox, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
 import { useEffect, useRef } from "react";
 import { useStore } from "../store/index.js";
+import { type SidebarCounts, selectionKey, sidebarCounts } from "../store/selectors.js";
 import { listDot } from "../styles.js";
-import type { TaskList } from "../types.js";
+import type { Selection, TaskList } from "../types.js";
```

The content page title in `src/components/window.tsx` takes the same treatment:

```diff
+import { selectionTitle } from "../store/selectors.js";
-<AdwNavigationPage title={lists.find((list) => list.id === selection.listId)?.name ?? "Tasks"}>
+<AdwNavigationPage title={selectionTitle(selection, lists)}>
```

## Filtering the visible list

A view answers which tasks, and a filter answers in what state. They are different questions, so they get different controls: the view is the sidebar, the filter is the header.

Add it to the UI slice in `src/store/ui.ts`:

```diff
 export type UiSlice = {
     selection: Selection;
     collapsed: boolean;
     showContent: boolean;
+    filter: Filter;
     select: (selection: Selection) => void;
+    setFilter: (filter: Filter) => void;
 };
```

```diff
-    selection: { kind: "list", listId: "personal" },
+    selection: { kind: "smart", view: "all" },
     collapsed: false,
     showContent: false,
+    filter: "all",
+    setFilter: (filter) => set({ filter }),
```

`Filter` joins the type import from `../types.js`.

All Tasks is now the launch view. Personal was the only sensible default while lists were the only thing to select. Now that a smart view can span every list, opening on everything you have is a better landing.

The filter is what the interface is currently doing, so it lives in the UI slice, which `partialize` excludes, and it starts at All on every launch. The sort order in [Preferences and the System Theme](/tutorial/preferences-and-theming) is a choice you made about the application, so it goes to GSettings and persists. Decide which kind a piece of state is before choosing where it lives.

The control is an `AdwToggleGroup`, the Adwaita segmented control, set as the header bar's title widget in `src/components/content-pane.tsx`:

```tsx
// ...

<AdwHeaderBar
    titleWidget={
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
    }
/>
```

Each `AdwToggle` carries a `name`, and the group reports the active one through its `active-name` property. Reading `activeName` from the store and writing it back from `onNotifyActiveName` is the controlled-widget pairing you used for the checkbox and the split view: the value prop says what should be shown, the signal reports what the widget did.

The guard exists because `onNotify` handlers hand you the raw property value, `string | null` here. `Filter` is narrower than `string`, so the check is what makes the assignment safe. It is a genuine type guard, so no cast appears in this file.

Pass the filter through in `src/components/task-list.tsx`:

```diff
+const filter = useStore((state) => state.filter);
+
-const visible = tasks.filter((task) => !task.deleted && task.listId === selection.listId);
+const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
```

## Searching titles and notes

`matchesQuery` is already wired into `visibleTasks`. All that is missing is somewhere to type.

More fields in `src/store/ui.ts`:

```diff
+    searchMode: boolean;
+    searchQuery: string;
+    setSearchMode: (searchMode: boolean) => void;
+    setSearchQuery: (searchQuery: string) => void;
```

```diff
+    searchMode: false,
+    searchQuery: "",
+    setSearchMode: (searchMode) => set({ searchMode }),
+    setSearchQuery: (searchQuery) => set({ searchQuery }),
```

`searchMode` is whether the bar is revealed, and `searchQuery` is what is in it. `select` clears both, since switching views with a stale search still applied would show an empty pane for no visible reason.

```diff
     select: (selection) =>
         set((state) => ({
             selection,
+            searchMode: false,
+            searchQuery: "",
             showContent: state.collapsed,
         })),
```

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

`GtkSearchBar` is a revealer with GNOME's search behavior built in, including dismissal on Escape. That dismissal is why `searchModeEnabled` is paired with `onNotifySearchModeEnabled`: the bar closes itself, and if that never reached the store the next render would reopen it. `?? false` handles the nullable notify value.

`GtkSearchEntry` emits `search-changed` on a short delay rather than on every keystroke, so a long query does not refilter the array once per character.

The button that reveals it goes in the header bar next to the filter, in `src/components/content-pane.tsx`:

```tsx
// ...

start={
    <GtkButton
        iconName="system-search-symbolic"
        tooltipText="Search (Ctrl+F)"
        onClicked={() => setSearchMode(!searchMode)}
    />
}
```

The tooltip mentions a keyboard shortcut you build in [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts).

One more line in the same file. Give the task list a key derived from the selection, so switching views mounts a fresh list rather than reusing the old one with its scroll position halfway down.

```diff
-<TaskList />
+<TaskList key={selectionKey(selection)} />
```

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

Render it below the list box in `src/components/task-list.tsx`, inside a vertical box so the two stack inside the clamp:

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

`AdwStatusPage` is the component that filled the window in [Your First Window](/tutorial/your-first-window). The `compact` style class shrinks its icon and type scale so it reads as a note under a card rather than the whole screen. The card stays mounted above it, because the add row lives in it and typing a task is what you most want to do from an empty view.

The task list derives its values at the top of the component:

```tsx
// ...

const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
const empty = emptyState(selection, searchQuery);
const listId = addListId(selection, lists);
```

Pure functions over selected arrays. No new state, and nothing written to disk.

`listId` is the third of the three expressions the union broke. The add row still reads `selection.listId`, which no longer type-checks and would file the task under the wrong list from a smart view, so point it at the derived value:

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
- Click the search button and type `report`. The list narrows as you type. Type `zzz`: the card empties and the note reads **No Results**, with your query quoted back. Clear the search and click **Trash** with nothing in it, and the note reads **Trash Is Empty** instead.

`filter` joined the UI slice on this page, so confirm the new field inherited the exclusion you established in [Lists and the Sidebar](/tutorial/lists-and-the-sidebar). Leave it on **Done**, quit the app, and start it again: it comes back on **All**, the same way the selection does.

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

[Opening a Task](/tutorial/the-task-editor) turns the content pane into an editor, where a task gains notes, a due date picked from a calendar, and an Important switch.
