---
description: "Organize tasks into lists and navigate between them with an Adwaita split view."
---

# Add Lists and a Sidebar

Your tasks now survive a restart. Add a sidebar for Personal, Work, and Shopping, with the selected list opening in the content pane.

## Add the lists

`Task` already has a `listId`. Add these two types to `src/types.ts`:

```diff [src/types.ts]
@@ -13,0 +14,8 @@
+
+export type TaskList = {
+    id: string;
+    name: string;
+    color: string;
+};
+
+export type Selection = { kind: "list"; listId: string };
```

In `src/store/seed.ts`, add `TaskList` to the existing type import and append the list defaults:

```diff [src/store/seed.ts]
@@ -1 +1 @@
-import type { Task } from "../types.js";
+import type { Task, TaskList } from "../types.js";
@@ -46,0 +47,6 @@
+
+export const seedLists: TaskList[] = [
+    { id: "personal", name: "Personal", color: "#3584e4" },
+    { id: "work", name: "Work", color: "#2ec27e" },
+    { id: "shopping", name: "Shopping", color: "#e66100" },
+];
```

Keep your existing `seedTasks`. Saved tasks take precedence over seed data, so changing that array would not add tasks to a list you have already saved. Shopping starts empty; you can add tasks to it through the app.

## Split the store

Separate tasks and lists using Zustand's [slices pattern](https://zustand.docs.pmnd.rs/learn/guides/slices-pattern). Persistence stays on the combined store.

Move the task state and actions into `src/store/tasks.ts`:

```ts [src/store/tasks.ts]
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

Create `src/store/lists.ts`:

```ts [src/store/lists.ts]
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

The New List dialog will use `addList` in [Add Undo and Delete Confirmation](/v2/tutorial/trash-and-toasts).

Replace `src/store/index.ts` with:

```ts [src/store/index.ts]
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Task, TaskList } from "../types.js";
import { createListsSlice, type ListsSlice } from "./lists.js";
import { fileStorage } from "./storage.js";
import { createTasksSlice, type TasksSlice } from "./tasks.js";

export type Store = TasksSlice & ListsSlice;

export type PersistedState = { lists: TaskList[]; tasks: Task[] };

export type Mutators = [["zustand/persist", unknown]];

let hydrationError: unknown;

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
            migrate: () => {
                throw new Error("Unsupported task data version");
            },
            onRehydrateStorage: () => (_state, error) => {
                hydrationError = error;
            },
        },
    ),
);

if (hydrationError !== undefined) {
    throw hydrationError;
}
```

Subsequent saves include both `tasks` and `lists`. Existing saved tasks remain intact, and `seedLists` supplies lists when loading a file from the previous chapter.

The selected list belongs to navigation state. Keep it out of the store: the route already identifies what the content pane shows. Later chapters put temporary filters in a UI slice and persistent application preferences in GSettings.

## Add the navigator

Install navigation and CSS support from the project directory:

::: code-group

```bash [npm]
npm install @gtkx/navigation@beta @gtkx/css@beta
```

```bash [pnpm]
pnpm add @gtkx/navigation@beta @gtkx/css@beta
```

:::

GTKX integrates React Navigation with libadwaita. Its split view navigator uses `AdwNavigationSplitView`: the first declared screen is the sidebar, and the remaining screens share a content stack. It supplies each screen's navigation page and header bar.

Create `src/navigation.ts`:

```ts [src/navigation.ts]
import { createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
import type { Selection } from "./types.js";

export type RootParamList = {
    Lists: undefined;
    Tasks: Selection;
};

export const Split = createSplitViewNavigator<RootParamList>();

const isSelection = (params: object | undefined): params is Selection =>
    params !== undefined && "kind" in params;

export const useSelection = (): Selection | null =>
    useNavigationState<RootParamList, Selection | null>((state) => {
        const params = state.routes.find((route) => route.name === "Tasks")?.params;
        return isSelection(params) ? params : null;
    });
```

`Tasks` carries the selected list in its params. `useSelection` lets the sidebar read that selection and returns `null` when no tasks page is open. The [navigation guide](/v2/guide/navigation) covers GTKX's navigators; React Navigation documents [route typing](https://reactnavigation.org/docs/typescript/).

## Move the window into a component

Create `src/components/window.tsx`:

```tsx [src/components/window.tsx]
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

`Lists` stays first so it owns the sidebar. `initialRouteName` and `initialParams` open Personal at startup. The tasks page's title follows its route params.

The navigator now owns the toolbar and header. Each screen supplies its content widget. Create `src/components/tasks-screen.tsx`:

```tsx [src/components/tasks-screen.tsx]
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => (
    <TaskList selection={route.params} />
);
```

Replace `src/app.tsx` with:

```tsx [src/app.tsx]
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

Keep the existing `src/index.tsx`; it still imports the named `App` export.

## Draw the sidebar

Use a small CSS rule for each list's color. Create `src/styles.ts`:

```ts [src/styles.ts]
import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;
```

Adwaita's built-in classes handle the rest of the styling. See [Styling with CSS](/v2/guide/css) for GTKX's CSS integration.

Create `src/components/sidebar.tsx`:

```tsx [src/components/sidebar.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { type RootParamList, useSelection } from "../navigation.js";
import { useStore } from "../store/index.js";
import { listDot } from "../styles.js";

export const Sidebar = ({ navigation }: SplitViewScreenProps<RootParamList, "Lists">) => {
    const lists = useStore((state) => state.lists);
    const selection = useSelection();

    const activeIndex = lists.findIndex((list) => list.id === selection?.listId);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListBox
                cssClasses={["navigation-sidebar"]}
                selectedIndex={activeIndex}
                onRowSelected={(row) => {
                    if (!row) return;
                    const list = lists[row.getIndex()];
                    if (list) {
                        navigation.navigate("Tasks", { kind: "list", listId: list.id });
                    }
                }}
            >
                {lists.map((list) => (
                    <AdwActionRow
                        key={list.id}
                        title={list.name}
                        useMarkup={false}
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

`useMarkup={false}` keeps list names literal. The colored dot is decorative, so it uses the presentation accessibility role.

## Keep selection in sync {#keeping-gtk4-and-the-route-in-agreement}

`selectedIndex` makes the native selection follow the route; `-1` clears it. `onRowSelected` handles selections made outside GTKX's prop writes. GTKX suppresses the signal caused by its own selection write, avoiding a navigation loop.

For this navigator, `navigate("Tasks", params)` returns to the existing tasks page with new params, removing any pages above it. If that page is absent, it opens it. Selecting a list therefore changes the content pane without accumulating task-list pages.

## Filter the tasks

Replace `src/components/task-list.tsx` with:

```tsx [src/components/task-list.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import type { Selection } from "../types.js";
import { TaskRow } from "./task-row.js";

export const TaskList = ({ selection }: { selection: Selection }) => {
    const tasks = useStore((state) => state.tasks);
    const addTask = useStore((state) => state.addTask);
    const visible = tasks.filter((task) => !task.deleted && task.listId === selection.listId);

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                    <AdwEntryRow
                        title="Add a task…"
                        onEntryActivated={(self) => {
                            addTask(selection.listId, self.text);
                            self.text = "";
                        }}
                    />
                    {visible.map((task) => (
                        <TaskRow key={task.id} task={task} />
                    ))}
                </GtkListBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
```

The screen passes its selection directly to the list. New tasks use that list's ID, while deleted tasks remain hidden.

## Run it

Save the files. Personal is selected in the sidebar, and its tasks appear under a header named Personal.

Click Work, then Shopping. Add a task in Shopping, switch to Personal, and return: the new task belongs only to Shopping.

Close the window and start `npm run dev` again. Tasks and lists return from disk; navigation starts on Personal again.

## Next

Continue to [Adapt the Layout](/v2/tutorial/an-adaptive-layout).
