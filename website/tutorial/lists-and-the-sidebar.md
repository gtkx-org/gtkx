---
description: "Add task lists, split the store into slices, and reach each list through a split view navigator."
---

# Lists and a Sidebar

Your tasks now survive a restart, saved as JSON under the XDG data directory by the [`persist` middleware](/tutorial/saving-to-disk). Everything is still one flat list, which stops working past a few dozen tasks.

Adding lists is enough new state to reorganize the store first. The selection that goes with them turns out not to be store state at all.

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

`src/store/index.ts` holds the state, every action, and the `persist` configuration in one file. Lists are about to join them, and every chapter after this one adds more, so split it while it is still small.

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

That is two slices, and the selection joins neither. It is not data you typed, so it has no business on disk. It is not a field either, because it is a place: it says which screen the right-hand pane is showing. The split view further down this page keeps that already, and writing it into the store as well would give one fact two homes, so the back button, the collapsed layout, and every later command that opens something would each have to keep both in step.

That decides where every new piece of state lands for the rest of the tutorial:

- Data the user typed goes in a persisted slice: `tasks`, `lists`.
- Where you are goes in the route's params. The selected list is what the tasks screen is showing, and the navigator owns it.
- What the interface is doing that is not a place goes in a UI slice, which `partialize` never writes to disk. [A Layout That Collapses](/tutorial/an-adaptive-layout) starts that slice with the collapse state, and it later holds the filter, the search query, and which dialog is open.
- Settings the user chose on purpose go in GSettings, which arrives in [Preferences and the System Theme](/tutorial/preferences-and-theming).

Neither of the middle two survives a restart. A window that opened narrow last time should not force a narrow layout onto a wide window today, and navigation state is never written to disk either, so a launch always starts where the navigator says it starts.

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

export type Store = TasksSlice & ListsSlice;

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

`Store` is the intersection of the slice types, so `useStore((state) => state.tasks)` and `useStore((state) => state.addList)` both typecheck against the same object. Call sites are unchanged: components read one bound store and never know a slice exists.

The `(...a)` spread matters here. Zustand hands a state creator `set`, `get`, and the store api. Forwarding those collected arguments to each slice gives every slice the same `set`, `get`, and store api, so they all write into one shared state object rather than separate ones.

`PersistedState` and `partialize` both gain `lists`, which puts your lists in the JSON file alongside your tasks.

## Screens instead of panes

`AdwNavigationSplitView` is Adwaita's master and detail layout: a sidebar pane beside a content pane, folding into a single pane on a window too narrow for both, which the next chapter turns on. Each pane holds an `AdwNavigationPage`, the unit Adwaita treats as one screen. A page has a title, it carries no header bar of its own, and it is what the navigation moves between.

Driving that widget by hand means owning the bookkeeping around it: which pane is showing, which page the content pane is on, what the back button and the back gesture do to each, and how all of it stays in step with the selected list. That is navigation, and it has a package.

`@gtkx/navigation` is [React Navigation](https://reactnavigation.org) 7 with libadwaita drawing the navigators, and its split view navigator *is* an `AdwNavigationSplitView`. You declare screens, and it builds the pages, their header bars, and the stack behind them. From `tasks/`:

::: code-group

```bash [npm]
npm install @gtkx/navigation
```

```bash [pnpm]
pnpm add @gtkx/navigation
```

:::

Like zustand, it belongs in `dependencies`: the navigator runs in the shipped application.

Two rules shape the rest of this page. **The first screen you declare is the sidebar**, and it stays in its pane, while every other screen is a page of the content pane's stack. And **a screen renders one root widget**, which the navigator wraps in the `AdwNavigationPage` and tops with an `AdwHeaderBar` built from that screen's options. So the `AdwToolbarView` and `AdwHeaderBar` you have written by hand since [Your First Window](/tutorial/your-first-window) leave the app here, and do not come back.

## The routes

The navigator needs to know its routes and what each one carries. That is one type, written once, and every `navigate` call and every `route.params` read is checked against it.

Create `src/navigation.ts`:

```ts
import { createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
import type { Selection } from "./types.js";

export type RootParamList = {
    Lists: undefined;
    Tasks: Selection;
};

export const Split = createSplitViewNavigator<RootParamList>();

const isSelection = (params: unknown): params is Selection =>
    typeof params === "object" && params !== null && "kind" in params;

export const useSelection = (): Selection | null =>
    useNavigationState<RootParamList, Selection | null>((state) => {
        const params = state.routes.find((route) => route.name === "Tasks")?.params;
        return isSelection(params) ? params : null;
    });
```

`Tasks: Selection` is the idea this chapter turns on. The selection is not something the tasks screen is told about, it is what the tasks screen *is*: the route and its params together say which list you are looking at. `Lists: undefined` says the sidebar route carries nothing, because the sidebar is one screen no matter what is selected.

`createSplitViewNavigator` returns the pair of components the tree is built from, `Split.Navigator` and `Split.Screen`, both typed against `RootParamList`.

A screen reads its own params from the `route` prop it is handed. The sidebar is a different route, so it has none to read, and `useSelection` is how it asks. `useNavigationState` runs a selector over the navigator's state and re-renders when the value changes, the same shape as a zustand selector. `state.routes` describes every route the navigator holds, so `find` can come back empty, and the params it returns are typed as whatever any screen takes. One guard answers both. It is a real type guard, so no cast appears in the file, and the `Selection | null` it produces is what every caller checks against.

## The window

This has outgrown `app.tsx`, so the window moves into `src/components/window.tsx`:

```tsx
import { AdwApplicationWindow } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { Split } from "../navigation.js";
import { useStore } from "../store/index.js";
import { Sidebar } from "./sidebar.js";
import { TasksScreen } from "./tasks-screen.js";

export const Window = () => {
    const lists = useStore((state) => state.lists);

    return (
        <AdwApplicationWindow title="Tasks" widthRequest={360} heightRequest={294} onCloseRequest={() => quit()}>
            <NavigationContainer>
                <Split.Navigator
                    initialRouteName="Tasks"
                    sidebarWidthFraction={0.25}
                    minSidebarWidth={220}
                    maxSidebarWidth={300}
                >
                    <Split.Screen name="Lists" component={Sidebar} options={{ title: "Tasks" }} />
                    <Split.Screen
                        name="Tasks"
                        component={TasksScreen}
                        initialParams={{ kind: "list", listId: "personal" }}
                        options={({ route }) => ({
                            title: lists.find((list) => list.id === route.params.listId)?.name ?? "Tasks",
                        })}
                    />
                </Split.Navigator>
            </NavigationContainer>
        </AdwApplicationWindow>
    );
};
```

`NavigationContainer` hosts the navigation tree. It draws no widgets of its own, only the context every screen and every hook below it reads, so it goes once, inside the window, around the root navigator.

Each `Split.Screen` names a route from `RootParamList` and says what renders it. `Lists` is declared first, so it is the sidebar. `Tasks` is a page of the content stack, and `initialRouteName="Tasks"` puts it on that stack at startup, so the app opens showing tasks rather than an empty content pane.

`initialParams` fills in the params a `navigate` call leaves out, which on the first render is all of them. It is the selection the app launches on, and because navigation state is never written to disk, every launch starts there.

`options` names the page and shapes its header bar. As an object it is fixed, which is all the sidebar needs. As a callback it receives the route, so the tasks page's title is derived from that page's own params and changes with the selection, and the screen underneath it never has to know its own title.

The width props keep the sidebar at a quarter of the window, bounded at 220 and 300 points, so it stays legible without eating the task list on a wide monitor.

The tasks screen has one job for now, turning the route's params into the prop the list wants. `src/components/tasks-screen.tsx`:

```tsx
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => (
    <TaskList selection={route.params} />
);
```

`SplitViewScreenProps` types the two props every screen receives, `route` and `navigation`, against the param list and one route name. Naming the route in the type is what makes `route.params` a `Selection` here rather than a union of every screen's params. [Opening a Task](/tutorial/the-task-editor) adds a second content screen, and this one keeps its params to itself.

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
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { useEffect, useRef } from "react";
import { type RootParamList, useSelection } from "../navigation.js";
import { useStore } from "../store/index.js";
import { listDot } from "../styles.js";

export const Sidebar = ({ navigation }: SplitViewScreenProps<RootParamList, "Lists">) => {
    const lists = useStore((state) => state.lists);
    const selection = useSelection();

    const activeIndex = lists.findIndex((list) => list.id === selection?.listId);
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
                    if (list && list.id !== selection?.listId) {
                        navigation.navigate("Tasks", { kind: "list", listId: list.id });
                    }
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

Selecting a list is a `navigate` to the `Tasks` route carrying the selection as params. In this navigator **`navigate` selects**: it returns to the named route with the new params and drops whatever sat above it, so picking a second list swaps what the content pane shows instead of piling a page on top of it. It also opens a route that is not on the stack yet by pushing it, which is what lets one call cover both cases.

The `navigation-sidebar` style class makes this look like a GNOME sidebar rather than a plain list: flat rows, no card, the selected row highlighted the way the platform highlights it. It is a plain string, like `boxed-list` on the task list.

Unlike the task list, this list box keeps its default selection mode. Selecting a row here *is* the interaction, so the widget's own selection is meaningful and should be visible.

The dot gets `accessibleRole={Gtk.AccessibleRole.PRESENTATION}`. The row's title already says which list it is, so the dot leaves the accessibility tree instead of being announced as an anonymous box.

## Keeping GTK4 and the route in agreement

This pattern recurs with every widget that owns state you also keep.

A `GtkListBox` holds its own selection. React does not tell it which row is selected; the box decides and reports. So there are two copies of the same fact, the widget's and the navigator's, kept in sync from both directions:

- **Widget to navigation.** The user clicks a row, the box emits `row-selected`, and `onRowSelected` navigates.
- **Navigation to widget.** Something other than a click changes the selection, so the effect calls `selectRow` to move the widget's highlight to match.

Run those naively and they feed each other. The effect calls `selectRow`, the box emits `row-selected` because its selection did change, and the handler navigates straight back to where you already are. Nothing visibly breaks yet, and the cost is one redundant navigation. But `navigate` here drops whatever sat above the `Tasks` route, so once [Opening a Task](/tutorial/the-task-editor) puts an editor up there, an echo tears it down while you are reading it.

The fix is the comparison already in the handler:

```tsx
if (list && list.id !== selection?.listId) {
    navigation.navigate("Tasks", { kind: "list", listId: list.id });
}
```

The handler returns early when nothing differs, so the echo stops at the first bounce. The rule applies to every widget that holds state your app also holds: **when you push state into a widget that reports its own changes, the report handler compares before it writes.**

## Filtering by list

The task list still shows everything. There is no field in the store to point it at, and its screen already holds the selection, so the list takes it as a prop.

In `src/components/task-list.tsx`:

```tsx
import type { Selection } from "../types.js"; // [!code ++]
// ...

export const TaskList = () => { // [!code --]
export const TaskList = ({ selection }: { selection: Selection }) => { // [!code ++]
    const tasks = useStore((state) => state.tasks);
    const addTask = useStore((state) => state.addTask);

    const visible = tasks.filter((task) => !task.deleted && task.listId === selection.listId); // [!code ++]

    // ...
```

The filter moves out of the JSX and into a named value, because everything the rest of the tutorial adds to it, a query, a state filter, a sort order, goes in the same place:

```diff
-{tasks.filter((task) => !task.deleted).map((task) => (
+{visible.map((task) => (
     <TaskRow key={task.id} task={task} />
 ))}
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

The store read that is left follows the rule from [Adding Tasks with a Store](/tutorial/the-task-store): select the smallest stable thing, `tasks`, and derive the rest during render. The filtering happens in the component body, not inside the selector. [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) explains why and moves this expression into a named function.

## Run it

Save, and the window rebuilds around the navigator.

It is now two panes. On the left, a sidebar with Personal, Work, and Shopping, each with a colored dot, Personal highlighted, under a header reading Tasks. That title is the `title` in the sidebar screen's options, and the header bar carrying it is the navigator's rather than yours. On the right, the tasks in Personal and nothing else, under a header naming the list.

Click **Work**. The content pane switches to the work tasks and its header reads Work. Click **Shopping** and it follows again.

Type a task into the add row while Shopping is selected, press Enter, then click Personal and back to Shopping. The new task is in Shopping and only in Shopping.

Navigation state never reaches disk, so only a new process shows the rest: close the window and start `npm run dev` again. Your lists and tasks return intact, and the selection is back on Personal, because the `Tasks` screen starts at its `initialParams` every time.

## Next

Continue to [A Layout That Collapses](/tutorial/an-adaptive-layout).
