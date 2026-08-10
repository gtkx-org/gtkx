---
description: "Add task lists, split the store into slices, and navigate between lists from a sidebar."
---

# Lists and a Sidebar

Your tasks now survive a restart, saved as JSON under the XDG data directory by the [`persist` middleware](/tutorial/saving-to-disk). Everything is still one flat list, which stops working past a few dozen tasks.

Adding lists and a selection is enough new state to reorganize the store first.

## A second type

A task belongs to exactly one list, so `Task` gains a `listId`. `Selection` is how the interface remembers which list you are looking at.

In `src/types.ts`:

```ts
export type TaskList = { // [!code ++]
    id: string; // [!code ++]
    name: string; // [!code ++]
    color: string; // [!code ++]
}; // [!code ++]
 // [!code ++]
export type Task = {
    id: string;
    listId: string; // [!code ++]
    title: string;
    // ...
};

export type Selection = { kind: "list"; listId: string }; // [!code ++]
```

A single-member union looks like a wrapper around a string. It is written this way because the sidebar will also hold entries that are not lists. [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) adds a second variant, and the `kind` tag tells them apart.

Your seed tasks already carry a `listId`, so they land in the right place as soon as the lists exist. In `src/store/seed.ts`:

```ts
import type { Task, TaskList } from "../types.js"; // [!code ++]

// ...

export const seedLists: TaskList[] = [ // [!code ++]
    { id: "personal", name: "Personal", color: "#3584e4" }, // [!code ++]
    { id: "work", name: "Work", color: "#2ec27e" }, // [!code ++]
    { id: "shopping", name: "Shopping", color: "#e66100" }, // [!code ++]
]; // [!code ++]

export const seedTasks: Task[] = [
    // ...
    task({ id: "t3", listId: "work", title: "Prepare the weekly report", position: 2, due: isoInDays(1) }),
    task({ id: "t4", listId: "work", title: "Review pull requests", position: 3 }), // [!code ++]
    task({ id: "t5", listId: "shopping", title: "Buy oat milk", position: 4 }), // [!code ++]
    task({ // [!code ++]
        id: "t6", // [!code ++]
        listId: "shopping", // [!code ++]
        title: "Order birthday gift", // [!code ++]
        position: 5, // [!code ++]
        due: isoInDays(3), // [!code ++]
        important: true, // [!code ++]
    }), // [!code ++]
];
```

The colors are the Adwaita palette's blue 3, green 4, and orange 3. Any hex string works.

## Splitting the store

`src/store/index.ts` holds the state, every action, and the `persist` configuration in one file. Lists and a selection are about to join them, so split it while it is still small.

Zustand calls the pieces **slices**. A slice is a function that returns part of the state, and the store is the slices spread into one object. Start with the tasks.

`src/store/tasks.ts`:

```ts
import type { StateCreator } from "zustand";
import type { Task } from "../types.js";
import type { Mutators, Store } from "./index.js";
import { seedTasks } from "./seed.js";

export type TasksSlice = {
    tasks: Task[];
    addTask: (listId: string, title: string) => string | null;
    setDone: (id: string, done: boolean) => void;
    setImportant: (id: string, important: boolean) => void;
    moveToTrash: (id: string) => void;
};

const patch = (tasks: Task[], id: string, fields: Partial<Task>): Task[] =>
    tasks.map((task) => (task.id === id ? { ...task, ...fields } : task));

export const createTasksSlice: StateCreator<Store, Mutators, [], TasksSlice> = (set) => ({
    tasks: seedTasks,
    addTask: (listId, title) => {
        const trimmed = title.trim();
        if (trimmed === "") return null;
        const id = crypto.randomUUID();
        set((state) => ({
            tasks: [
                ...state.tasks,
                {
                    id,
                    listId,
                    title: trimmed,
                    notes: "",
                    done: false,
                    important: false,
                    deleted: false,
                    due: null,
                    position: state.tasks.length,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                },
            ],
        }));
        return id;
    },
    setDone: (id, done) =>
        set((state) => ({
            tasks: patch(state.tasks, id, { done, completedAt: done ? new Date().toISOString() : null }),
        })),
    setImportant: (id, important) => set((state) => ({ tasks: patch(state.tasks, id, { important }) })),
    moveToTrash: (id) => set((state) => ({ tasks: patch(state.tasks, id, { deleted: true }) })),
});
```

The state and the actions are the ones you already wrote. The signature on top is new, and every slice in the app carries it:

```ts
StateCreator<Store, Mutators, [], TasksSlice>
```

- `Store` is the **whole** store, not this slice. That is what lets a slice read another slice's state inside `set((state) => ...)`, and why every slice imports `Store` from `index.ts`.
- `Mutators` is the middleware wrapping the store, `[["zustand/persist", unknown]]`. Zustand needs it so `set` has the right type inside the slice: a persisted store has a richer setter than a bare one.
- The empty tuple is the middleware this slice applies on its own, which is none.
- `TasksSlice` is what this slice contributes to the store.

So the rule: **middleware is applied once, to the combined store, and never inside a slice.** A slice describes state and behavior. Persistence is a property of the store as a whole.

Lists are much smaller. `src/store/lists.ts`:

```ts
import type { StateCreator } from "zustand";
import type { TaskList } from "../types.js";
import type { Mutators, Store } from "./index.js";
import { seedLists } from "./seed.js";

export type ListsSlice = {
    lists: TaskList[];
    addList: (name: string, color: string) => void;
};

export const createListsSlice: StateCreator<Store, Mutators, [], ListsSlice> = (set) => ({
    lists: seedLists,
    addList: (name, color) => {
        const trimmed = name.trim();
        if (trimmed === "") return;
        set((state) => ({ lists: [...state.lists, { id: crypto.randomUUID(), name: trimmed, color }] }));
    },
});
```

Nothing calls `addList` yet. The dialog that does arrives in [Deleting Without Fear](/tutorial/trash-and-toasts). The action lives here because it belongs with the state it changes.

## Where new state goes

The selection is not data you typed, it is what the interface is currently doing. When you reopen the app, it should not matter which list was highlighted when you quit. So it goes in a slice that `partialize` never writes to disk.

`src/store/ui.ts`:

```ts
import type { StateCreator } from "zustand";
import type { Selection } from "../types.js";
import type { Mutators, Store } from "./index.js";

export type UiSlice = {
    selection: Selection;
    select: (selection: Selection) => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    selection: { kind: "list", listId: "personal" },
    select: (selection) => set({ selection }),
});
```

That decides where every new field lands for the rest of the tutorial:

- Data the user typed goes in a persisted slice: `tasks`, `lists`.
- What the interface is currently doing goes in the UI slice: the selection now, and later the filter, the search query, and which dialog is open.
- Settings the user chose on purpose go in GSettings, which arrives in [Preferences and the System Theme](/tutorial/preferences-and-theming).

## Composing them

`src/store/index.ts` now does one job: put the slices together and configure `persist`.

`src/store/index.ts`:

```ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Task, TaskList } from "../types.js";
import { createListsSlice, type ListsSlice } from "./lists.js";
import { seedLists, seedTasks } from "./seed.js";
import { fileStorage } from "./storage.js";
import { createTasksSlice, type TasksSlice } from "./tasks.js";
import { createUiSlice, type UiSlice } from "./ui.js";

export type Store = TasksSlice & ListsSlice & UiSlice;

export type PersistedState = { lists: TaskList[]; tasks: Task[] };

export type Mutators = [["zustand/persist", unknown]];

const isPersistedState = (value: unknown): value is PersistedState =>
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "lists")) &&
    Array.isArray(Reflect.get(value, "tasks"));

export const useStore = create<Store>()(
    persist(
        (...a) => ({
            ...createTasksSlice(...a),
            ...createListsSlice(...a),
            ...createUiSlice(...a),
        }),
        {
            name: "tasks",
            version: 1,
            storage: createJSONStorage(() => fileStorage),
            partialize: (state): PersistedState => ({ lists: state.lists, tasks: state.tasks }),
            migrate: (persisted) => (isPersistedState(persisted) ? persisted : { lists: seedLists, tasks: seedTasks }),
        },
    ),
);
```

`Store` is the intersection of the slice types, so `useStore((state) => state.tasks)` and `useStore((state) => state.select)` both typecheck against the same object. Call sites are unchanged: components read one bound store and never know a slice exists.

The `(...a)` spread matters here. Zustand hands a state creator `set`, `get`, and the store api. Forwarding those collected arguments to each slice gives every slice the same `set`, `get`, and store api, so they all write into one shared state object rather than separate ones.

`PersistedState` and `partialize` both gain `lists`, which puts your lists in the JSON file alongside your tasks. `selection` is absent from both, so it starts at Personal on every launch.

## The two panes

`AdwNavigationSplitView` shows a sidebar and a content area side by side, and folds into a single pane on a narrow window, which the next chapter turns on.

Its `sidebar` and `content` are container slots, the same idea as `topBar` on `AdwToolbarView`. Each takes an `AdwNavigationPage`, the unit Adwaita treats as one pane: a page has a title, and it is what the navigation moves between.

A page carries no header bar of its own, so each supplies its own `AdwToolbarView` with its own `AdwHeaderBar`. The two headers hold different controls, and once collapsed only one is on screen at a time.

This has outgrown `app.tsx`, so the window moves into `src/components/window.tsx`:

```tsx
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";
import { useStore } from "../store/index.js";
import { ContentPane } from "./content-pane.js";
import { Sidebar } from "./sidebar.js";

export const Window = () => {
    const lists = useStore((state) => state.lists);
    const selection = useStore((state) => state.selection);
    const title = lists.find((list) => list.id === selection.listId)?.name ?? "Tasks";

    return (
        <AdwApplicationWindow
            title="Tasks"
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
        >
            <AdwNavigationSplitView
                sidebarWidthFraction={0.25}
                minSidebarWidth={220}
                maxSidebarWidth={300}
                sidebar={
                    <AdwNavigationPage title="Tasks">
                        <AdwToolbarView topBar={<AdwHeaderBar />}>
                            <Sidebar />
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
            >
                <AdwNavigationPage title={title}>
                    <ContentPane />
                </AdwNavigationPage>
            </AdwNavigationSplitView>
        </AdwApplicationWindow>
    );
};
```

The width props keep the sidebar at a quarter of the window, bounded at 220 and 300 points, so it stays legible without eating the task list on a wide monitor.

The content pane pairs a header bar with what goes under it. It stays thin for now. [Opening a Task](/tutorial/the-task-editor) makes it choose between the list and an editor, and that choice happens here.

`src/components/content-pane.tsx`:

```tsx
import { AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { TaskList } from "./task-list.js";

export const ContentPane = () => (
    <AdwToolbarView topBar={<AdwHeaderBar />}>
        <TaskList />
    </AdwToolbarView>
);
```

`app.tsx` is left holding the application root, `src/app.tsx`:

```tsx
import { AdwApplication } from "@gtkx/jsx/adw";
import { Window } from "./components/window.js";

export function App() {
    return (
        <AdwApplication>
            <Window />
        </AdwApplication>
    );
}
```

## A dot for each list

Each sidebar row shows its list's color as a small filled circle. GTK4 styles widgets with CSS, and `@gtkx/css` gives you a `css` tagged template that takes a rule body, registers it with the style manager, and returns a generated class name you hand to `cssClasses`.

Because the color is interpolated, `listDot` is a function: call it with a hex string, get back a class name for a dot of that color.

`src/styles.ts`:

```ts
import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;
```

Reach for this sparingly. Adwaita's own style classes, like `boxed-list` and `flat`, cover almost everything and follow the user's theme. Write CSS only for what the platform has no class for, like a colored dot. For more, see [Styling with CSS](/guide/css).

## The sidebar

`src/components/sidebar.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useEffect, useRef } from "react";
import { useStore } from "../store/index.js";
import { listDot } from "../styles.js";

export const Sidebar = () => {
    const lists = useStore((state) => state.lists);
    const selection = useStore((state) => state.selection);
    const select = useStore((state) => state.select);

    const activeIndex = lists.findIndex((list) => list.id === selection.listId);
    const listRef = useRef<Gtk.ListBox | null>(null);

    useEffect(() => {
        const box = listRef.current;
        if (!box || activeIndex < 0) return;
        const row = box.getRowAtIndex(activeIndex);
        if (row) box.selectRow(row);
    }, [activeIndex]);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListBox
                ref={listRef}
                cssClasses={["navigation-sidebar"]}
                onRowSelected={(row) => {
                    if (!row) return;
                    const list = lists[row.getIndex()];
                    if (list && list.id !== selection.listId) select({ kind: "list", listId: list.id });
                }}
            >
                {lists.map((list) => (
                    <AdwActionRow
                        key={list.id}
                        title={list.name}
                        prefix={
                            <GtkBox
                                valign={Gtk.Align.CENTER}
                                cssClasses={[listDot(list.color)]}
                                accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                            />
                        }
                    />
                ))}
            </GtkListBox>
        </GtkScrolledWindow>
    );
};
```

The `navigation-sidebar` style class makes this look like a GNOME sidebar rather than a plain list: flat rows, no card, the selected row highlighted the way the platform highlights it. It is a plain string, like `boxed-list` on the task list.

Unlike the task list, this list box keeps its default selection mode. Selecting a row here *is* the interaction, so the widget's own selection is meaningful and should be visible.

The dot gets `accessibleRole={Gtk.AccessibleRole.PRESENTATION}`. The row's title already says which list it is, so the dot leaves the accessibility tree instead of being announced as an anonymous box.

## Keeping GTK4 and the store in agreement

This pattern recurs with every widget that owns state you also keep.

A `GtkListBox` holds its own selection. React does not tell it which row is selected; the box decides and reports. So there are two copies of the same fact, the widget's and the store's, kept in sync from both directions:

- **Widget to store.** The user clicks a row, the box emits `row-selected`, and `onRowSelected` writes the new selection into the store.
- **Store to widget.** Something other than a click changes the selection, so the effect calls `selectRow` to move the widget's highlight to match.

Run those naively and they feed each other. The effect calls `selectRow`, the box emits `row-selected` because its selection did change, and the handler writes the value back into the store. The value is identical, so nothing visibly breaks, but every programmatic selection costs a redundant store write. Once `select` does more than set one field (it starts doing that in the [next chapter](/tutorial/an-adaptive-layout)) the echo becomes a real bug.

The fix is the comparison already in the handler:

```tsx
if (list && list.id !== selection.listId) select({ kind: "list", listId: list.id });
```

The handler returns early when nothing differs, so the echo stops at the first bounce. The rule applies to every widget that holds state React also holds: **when you push state into a widget that reports its own changes, the report handler compares before it writes.**

## Filtering by list

The task list still shows everything. Point it at the selection.

In `src/components/task-list.tsx`:

```tsx
export const TaskList = () => {
    const tasks = useStore((state) => state.tasks);
    const selection = useStore((state) => state.selection); // [!code ++]
    const addTask = useStore((state) => state.addTask);

    const visible = tasks.filter((task) => !task.deleted); // [!code --]
    const visible = tasks.filter((task) => !task.deleted && task.listId === selection.listId); // [!code ++]

    // ...
```

And the add row creates the new task in the list you are looking at:

```tsx
<AdwEntryRow
    title="Add a task…"
    onEntryActivated={(self) => {
        addTask(selection.listId, self.text); // [!code ++]
        self.text = "";
    }}
/>
```

Both follow the reading rule from [Adding Tasks with a Store](/tutorial/the-task-store): select the smallest stable thing, `tasks` and `selection`, and derive the rest during render. The filtering happens in the component body, not inside the selector. [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) explains why and moves this expression into a named function.

## Run it

Save, and the window rebuilds around the split view.

The window is now two panes. On the left, a sidebar with Personal, Work, and Shopping, each with a colored dot, Personal highlighted. On the right, the tasks in Personal and nothing else.

Click **Work**. The content pane switches to the work tasks and the window title changes to Work. Click **Shopping** and it follows again.

Type a task into the add row while Shopping is selected, press Enter, then click Personal and back to Shopping. The new task is in Shopping and only in Shopping.

The UI slice never reaches disk, so only a new process shows the difference: close the window and start `npm run dev` again. Your lists and tasks return intact, and the selection is back on Personal.

## Next

Continue to [A Layout That Collapses](/tutorial/an-adaptive-layout).
