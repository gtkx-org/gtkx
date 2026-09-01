---
title: "Tasks, State, and Persistence"
description: "Model the task manager, render its list, and persist state safely."
---

# Tasks, State, and Persistence

Keep domain state independent from widgets. Components should select values and invoke store operations; the store should own IDs, timestamps, filtering, and persistence.

## Model the state

The finished example uses small domain types and a Zustand store in [`src/store`](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/src/store). The essential shape is:

```ts
type Task = {
    id: string;
    listId: string;
    title: string;
    notes: string;
    done: boolean;
    important: boolean;
    deleted: boolean;
    due: string | null;
};

type TasksState = {
    tasks: Task[];
    addTask(listId: string, title: string): string | null;
    updateTask(id: string, changes: Partial<Task>): void;
};
```

Expose intent-based operations such as `completeTask`, `moveTask`, and `restoreTask` when they enforce a rule. Keep transient search, selection, and filter state outside the persisted domain slice.

## Render observable rows

Build rows from the selected tasks and use stable IDs as React keys. Buttons and signal props should call store operations; widgets do not need to know how persistence works.

The finished [`task-row.tsx`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/components/task-row.tsx) shows accessible labels, completion, importance, deletion, and navigation without hiding those behaviors behind a custom widget abstraction.

Use `@gtkx/components` for model-backed GTK lists when the collection is large or reorderable. A direct JSX map is enough for a short, static group.

## Save atomically

Resolve the data directory from `XDG_DATA_HOME`, falling back to the platform data directory. Serialize only the persisted slice, write a sibling temporary file, then rename it over the destination. The rename prevents a partial write from replacing valid state.

The complete implementation is in [`storage.ts`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/store/storage.ts). Keep these boundaries:

- Treat a missing file as first launch.
- Reject or migrate invalid stored shapes before exposing them to components.
- Create the parent directory before the first save.
- Do not persist search text, the active filter, navigation state, or open dialogs.

## Check the result

Add, complete, and delete a task, then restart the application. Domain changes should survive; the current screen and filters should reset.

Next, [put lists and task details into an adaptive navigator](/tutorial/an-adaptive-layout).
