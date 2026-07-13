---
description: "The Tasks data layer, with JSON in the XDG data directory through GLib file APIs, GSettings for preferences, and React state as the source of truth."
---

# Data Model and Persistence

Tasks keeps two entirely separate stores, and the split is deliberate. The task list itself, everything the user creates and edits, lives as one JSON file in the XDG data directory, loaded once at startup and written back through GLib's own file API. The handful of small UI preferences (filter, sort order, color scheme, window size) live in GSettings, the GNOME settings database. React state is the single source of truth while the app runs; both stores are just where that state is serialized to and rehydrated from.

If you come from the web, the surprising part is not React. It is that the byte-level I/O runs through `@gtkx/gi/glib` instead of `node:fs`, and that "the settings system" (GSettings) is a real, schema-validated key store that GNOME ships, not something you build. This page walks the real data layer of the app: `types.ts` (the shapes), `store.ts` (JSON load and save), the `useTasks` hook (state plus every mutation), and the gschema that defines the preference keys.

## The shapes

`src/types.ts` is the whole domain model. A `Task` is a flat, JSON-friendly record. A `TaskList` is an id, a display name, and a color string used for the sidebar dot. Notice there are no live GTK objects here, and no `Date` instances: `due`, `createdAt`, and `completedAt` are ISO-8601 strings (or `null`) so the record survives `JSON.stringify` untouched.

```ts
export type TaskList = {
    id: string;
    name: string;
    color: string;
};

export type Task = {
    id: string;
    listId: string;
    title: string;
    notes: string;
    done: boolean;
    important: boolean;
    deleted: boolean;
    due: string | null;
    position: number;
    createdAt: string;
    completedAt: string | null;
};
```

Two fields do real work later. `position` is the manual sort index that drag-to-reorder rewrites. `deleted` is a soft-delete flag: trashing a task flips `deleted` to `true` rather than removing it, which is what makes the Trash smart view and the undo toast possible without a second data structure.

The remaining two types describe what the sidebar has selected, not stored data. A `Selection` is a discriminated union: either one of the built-in smart views or a specific user list by id.

```ts
export type SmartView = "all" | "today" | "important" | "trash";

export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };
```

## Paths and encoding: the GLib file layer

`src/store.ts` owns everything that touches disk. It starts by building the file path from GLib's XDG helpers, so the app writes to the correct per-user location on any platform without hardcoding a separator or a home directory.

```ts
import * as GLib from "@gtkx/gi/glib";
import type { Task, TaskList } from "./types.js";

const APP_ID = "com.gtkx.tutorial";
const DATA_DIR = GLib.buildFilenamev([GLib.getUserDataDir(), APP_ID]);
const TASKS_PATH = GLib.buildFilenamev([DATA_DIR, "tasks.json"]);
const SCHEMA_VERSION = 1;

export type PersistedState = {
    version: number;
    lists: TaskList[];
    tasks: Task[];
};
```

`GLib.getUserDataDir()` returns `$XDG_DATA_HOME`, defaulting to `~/.local/share`, so the file lands at `~/.local/share/com.gtkx.tutorial/tasks.json`. `GLib.buildFilenamev(parts: string[])` joins path segments with the platform separator. `PersistedState` is the exact JSON envelope: a `version` number for migration, plus the `lists` and `tasks` arrays.

GLib's file functions marshal bytes as a plain `number[]` (an array of byte values), not a Node `Buffer` or a `Uint8Array`. So the two ends convert through the standard web encoders:

```ts
const encode = (value: string): number[] => Array.from(new TextEncoder().encode(value));
const decode = (bytes: number[]): string => new TextDecoder().decode(new Uint8Array(bytes));
```

`TextEncoder`/`TextDecoder` are web platform globals, available here because gtkx runs your app on a bundled Node runtime.

## First run: the seed

When there is no file yet, the app has to start from something. `seed()` returns a `PersistedState` with three example lists and six example tasks, so a fresh install opens onto real content instead of an empty screen. `isoInDays` builds due dates relative to today (18:00), and `make` fills in the boilerplate fields so each task literal only spells out what differs.

```ts
const seed = (): PersistedState => {
    const now = new Date().toISOString();
    const lists: TaskList[] = [
        { id: "personal", name: "Personal", color: "#3584e4" },
        { id: "work", name: "Work", color: "#2ec27e" },
        { id: "shopping", name: "Shopping", color: "#e66100" },
    ];
    const make = (task: Partial<Task> & Pick<Task, "id" | "listId" | "title" | "position">): Task => ({
        notes: "",
        done: false,
        important: false,
        deleted: false,
        due: null,
        createdAt: now,
        completedAt: null,
        ...task,
    });
    const tasks: Task[] = [
        make({
            id: "t1",
            listId: "personal",
            title: "Welcome to Tasks",
            position: 0,
            notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
        }),
        make({
            id: "t2",
            listId: "personal",
            title: "Water the plants",
            position: 1,
            due: isoInDays(0),
            important: true,
        }),
        // ...
    ];
    return { version: SCHEMA_VERSION, lists, tasks };
};
```

The color values (`#3584e4`, `#2ec27e`, `#e66100`) are GNOME's standard palette accent colors, so the seeded lists match the platform look.

## Loading: seed, corruption, and version guard in one function

`loadState` handles all three ways loading can go wrong (no file, unreadable file, garbage or stale contents) and always returns a valid `PersistedState`. This matters because it runs as the lazy `useState` initializer: if it threw, the whole app would fail to mount.

```ts
export const loadState = (): PersistedState => {
    try {
        if (!GLib.fileTest(TASKS_PATH, GLib.FileTest.EXISTS)) return seed();
        const [ok, bytes] = GLib.fileGetContents(TASKS_PATH);
        if (!ok) return seed();
        const parsed = JSON.parse(decode(bytes)) as PersistedState;
        if (parsed?.version !== SCHEMA_VERSION) return seed();
        return parsed;
    } catch {
        return seed();
    }
};
```

Read it top to bottom as a chain of guards:

- `GLib.fileTest(path, GLib.FileTest.EXISTS)` is `g_file_test` with the `EXISTS` flag. No file means first run, so seed.
- `GLib.fileGetContents(path)` returns a `[ok, bytes]` tuple (GLib's out-parameters surface as a returned array). A false `ok` means the read failed, so seed.
- The `try/catch` wraps `JSON.parse`, so a truncated or corrupt file falls through to the same seed instead of crashing at startup.
- `parsed?.version !== SCHEMA_VERSION` rejects data written by a future or incompatible schema. Bump `SCHEMA_VERSION` and add migration branches here when the shape changes; today anything that does not match reseeds.

## Saving: one atomic write

`saveState` ensures the directory exists, then writes the pretty-printed JSON in a single call.

```ts
export const saveState = (state: PersistedState): void => {
    GLib.mkdirWithParents(DATA_DIR, 0o755);
    GLib.fileSetContents(TASKS_PATH, encode(JSON.stringify(state, null, 2)));
};
```

`GLib.mkdirWithParents(dir, 0o755)` is `g_mkdir_with_parents`, creating the namespaced directory (and any missing parent) on first save. `GLib.fileSetContents(path, bytes)` is the important one for durability.

::: tip g_file_set_contents is atomic
`GLib.fileSetContents` wraps `g_file_set_contents_full` with the `CONSISTENT` flag: internally it writes to a temporary file in the same directory and renames it over the target. A crash or `SIGKILL` mid-write can never leave a half-written `tasks.json`; a reader always sees either the complete old file or the complete new one. You get the temp-then-rename safety without writing it yourself.
:::

## The hook: state plus every mutation

`src/hooks/use-tasks.ts` is where the store meets React. `useTasks` holds the entire `PersistedState` in one `useState`, seeds it lazily from disk, and returns a flat API of mutation functions. Every component that changes data calls one of these; nothing else touches `store.ts`.

```ts
import { useEffect, useState } from "react";
import { loadState, type PersistedState, saveState } from "../store.js";
import type { Task } from "../types.js";

const reindex = (tasks: Task[]): Task[] => tasks.map((task, index) => ({ ...task, position: index }));

const now = (): string => new Date().toISOString();

export type TasksApi = ReturnType<typeof useTasks>;

export const useTasks = () => {
    const [state, setState] = useState<PersistedState>(loadState);
    // ...
};
```

Passing `loadState` (the function reference, not `loadState()`) is the lazy-initializer form: React calls it exactly once, on mount. The disk read never happens again on re-render. `TasksApi` is derived with `ReturnType<typeof useTasks>`, so the API type stays in sync with the implementation automatically.

### The debounced save effect

There is no explicit "save" button and no save call inside the actions. Instead, one effect watches `state` and writes it 500ms after the last change:

```ts
useEffect(() => {
    const handle = setTimeout(() => saveState(state), 500);
    return () => clearTimeout(handle);
}, [state]);
```

Because `state` is in the dependency array, every mutation reschedules the timer: the cleanup clears the previous `setTimeout` and a new one starts. A burst of edits collapses into a single disk write 500ms after the user stops. This is the crash safety net, at most half a second of work is ever at risk.

### Two helpers behind the actions

Almost every action is expressed through two tiny helpers, so the individual mutations stay one-liners. `mutate` swaps in a new `tasks` array while preserving the rest of the state; `patch` merges fields into the one task whose id matches.

```ts
const mutate = (updater: (tasks: Task[]) => Task[]): void =>
    setState((current) => ({ ...current, tasks: updater(current.tasks) }));

const patch = (id: string, fields: Partial<Task>): void =>
    mutate((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...fields } : task)));

const withDone = (task: Task, done: boolean): Task => ({
    ...task,
    done,
    completedAt: done ? now() : null,
});
```

`withDone` keeps `done` and `completedAt` consistent: completing a task stamps `completedAt`, un-completing it clears the stamp back to `null`.

### Adding

`addTask` trims the title, returns `null` if it is empty (so a blank entry row is a no-op), mints an id with the Web Crypto `crypto.randomUUID()`, appends the task at `position: tasks.length`, and returns the new id so the caller can immediately select or open it.

```ts
const addTask = (listId: string, title: string): string | null => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const id = crypto.randomUUID();
    mutate((tasks) => [
        ...tasks,
        {
            id,
            listId,
            title: trimmed,
            notes: "",
            done: false,
            important: false,
            deleted: false,
            due: null,
            position: tasks.length,
            createdAt: now(),
            completedAt: null,
        },
    ]);
    return id;
};

const addList = (name: string, color: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((current) => ({
        ...current,
        lists: [...current.lists, { id: crypto.randomUUID(), name: trimmed, color }],
    }));
};
```

`addList` is the parallel for lists; it edits `current.lists` directly (not through `mutate`, which only touches `tasks`).

### Editing a single task

```ts
const setDone = (id: string, done: boolean): void =>
    mutate((tasks) => tasks.map((task) => (task.id === id ? withDone(task, done) : task)));

const toggleDone = (id: string): void =>
    mutate((tasks) => tasks.map((task) => (task.id === id ? withDone(task, !task.done) : task)));

const setImportant = (id: string, important: boolean): void => patch(id, { important });

const updateTask = (id: string, fields: Partial<Pick<Task, "title" | "notes" | "due" | "listId">>): void =>
    patch(id, fields);
```

`setDone` and `toggleDone` go through `withDone` to keep the completion timestamp honest. `updateTask` is the editor's catch-all: its `fields` type is narrowed to just the four user-editable fields, so the form cannot accidentally patch `done` or `position`.

### Trash, restore, delete

Soft delete and hard delete are different operations. `moveToTrash` and `restore` only flip the `deleted` flag, keeping the task recoverable and undoable. `deleteForever` is the only one that actually removes the record from the array.

```ts
const moveToTrash = (id: string): void => patch(id, { deleted: true });

const restore = (id: string): void => patch(id, { deleted: false });

const deleteForever = (id: string): void => mutate((tasks) => tasks.filter((task) => task.id !== id));
```

### Batch operations

Selection mode acts on many tasks at once. Each of these takes an array of ids and maps over the tasks, applying the change where `ids.includes(task.id)`:

```ts
const moveToList = (ids: string[], listId: string): void =>
    mutate((tasks) => tasks.map((task) => (ids.includes(task.id) ? { ...task, listId } : task)));

const completeMany = (ids: string[]): void =>
    mutate((tasks) => tasks.map((task) => (ids.includes(task.id) ? withDone(task, true) : task)));

const trashMany = (ids: string[]): void =>
    mutate((tasks) => tasks.map((task) => (ids.includes(task.id) ? { ...task, deleted: true } : task)));
```

### Reorder with reindex

Drag-to-reorder moves a task from its current slot to just before the drop target, then rewrites every `position` to match the new array order. `reindex` (defined at the top of the file) is what makes `position` a live, persisted value rather than dead state.

```ts
const reorder = (draggedId: string, targetId: string): void =>
    mutate((tasks) => {
        const from = tasks.findIndex((task) => task.id === draggedId);
        const to = tasks.findIndex((task) => task.id === targetId);
        if (from === -1 || to === -1 || from === to) return tasks;
        const next = [...tasks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return reindex(next);
    });
```

Returning the original `tasks` array unchanged when the indices are missing or equal skips the splice and reindex work for a no-op drag.

### What the hook returns

```ts
return {
    lists: state.lists,
    tasks: state.tasks,
    addTask,
    setDone,
    toggleDone,
    setImportant,
    updateTask,
    moveToTrash,
    restore,
    deleteForever,
    moveToList,
    completeMany,
    trashMany,
    reorder,
    addList,
    flush,
};
```

## Flush on close

The 500ms debounce is a safety net, not a clean exit. On a normal quit the app should not lose the last edit sitting inside a pending timer, so the hook also exposes a synchronous `flush`:

```ts
const flush = (): void => saveState(state);
```

The window wires it into its close handler. `handleClose` (in `app.tsx`) flushes the task data straight to disk, then quits:

```tsx
const handleClose = (): boolean => {
    api.flush();
    return quit();
};
```

(The window size is not captured here. It is bound to GSettings continuously with `useBindSetting`, covered on the application-shell page.)

```tsx
<AdwApplicationWindow
    // ...
    onCloseRequest={handleClose}
>
```

`onCloseRequest` is the JSX form of the `GtkWindow::close-request` signal. `flush` runs `saveState` immediately, bypassing the debounce, so the file on disk always reflects the last state before the process exits.

## The other store: GSettings for UI preferences

Task data is JSON; UI preferences are GSettings. GSettings is GNOME's schema-defined settings database (backed by dconf), and it is the right home for small, discrete values that GTK and libadwaita already know how to bind to. It is the wrong home for the task list: dconf is not meant for large or frequently-churned blobs.

The preference keys are declared in `data/com.gtkx.tutorial.gschema.xml`. Each key has a type, an optional constraint, a default, and human-readable summary/description text.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <enum id="com.gtkx.tutorial.SortOrder">
    <value nick="manual" value="0"/>
    <value nick="due-date" value="1"/>
    <value nick="title" value="2"/>
    <value nick="created" value="3"/>
  </enum>
  <schema id="com.gtkx.tutorial" path="/com/gtkx/tutorial/">
    <key name="filter" type="s">
      <choices>
        <choice value="all"/>
        <choice value="open"/>
        <choice value="done"/>
      </choices>
      <default>'all'</default>
      <summary>Task filter</summary>
      <description>Which tasks are shown in the list</description>
    </key>
    <key name="sort-order" enum="com.gtkx.tutorial.SortOrder">
      <default>'manual'</default>
      <summary>Sort order</summary>
      <description>How tasks are ordered in the list</description>
    </key>
    <key name="color-scheme" type="s">
      <choices>
        <choice value="default"/>
        <choice value="light"/>
        <choice value="dark"/>
      </choices>
      <default>'default'</default>
      <summary>Color scheme</summary>
      <description>Follow the system theme or force light or dark</description>
    </key>
    <key name="reminder-minutes" type="i">
      <range min="0" max="1440"/>
      <default>30</default>
      <summary>Reminder lead time</summary>
      <description>Minutes before a due time to show a reminder</description>
    </key>
    <key name="window-width" type="i">
      <default>900</default>
      <summary>Window width</summary>
      <description>Last saved window width in pixels</description>
    </key>
    <key name="window-height" type="i">
      <default>600</default>
      <summary>Window height</summary>
      <description>Last saved window height in pixels</description>
    </key>
  </schema>
</schemalist>
```

Two things worth calling out in the schema format:

- **Constrained strings, two ways.** `filter` and `color-scheme` inline a `<choices>` list; `sort-order` references a top-level `<enum>` by id via `enum="..."`, and its `<default>` is one of the enum *nicks*, single-quoted. Both forms produce a key GSettings validates against its allowed set, so a write of an undeclared value is rejected.
- **Ranged integer.** `reminder-minutes` is `type="i"` with a `<range min="0" max="1440"/>`, capping the reminder lead time to a day.

Every key here is small, discrete UI state: which filter is active, how the list is sorted, the forced color scheme, reminder lead time, and the last window geometry. None of it is task content. That is the whole contrast: **task data round-trips through JSON in the XDG data dir; only these lightweight preferences live in GSettings.** How components read and write these keys with the `useSetting` hook is covered on the Preferences and Theming page.

::: info node:fs is available, but GLib keeps I/O dependency-free
Because gtkx bundles a Node runtime, `node:fs` (`readFileSync`, `writeFileSync`, and friends) works here just like in any Node program. This app deliberately uses `@gtkx/gi/glib` instead: GLib is already a dependency of every GTK app, it supplies the XDG-correct paths, and `g_file_set_contents` gives the atomic write for free. Reaching for `node:fs` is a valid choice when you want Node's streaming or watching APIs; for a whole-file JSON store, GLib keeps the data layer dependency-free.
:::

## Next

Continue to **The Sidebar**, where the `Selection` and `SmartView` types from `types.ts` drive the navigation list, the smart views, and the user's task lists.
