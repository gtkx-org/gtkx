---
description: "Model a task and display sample data in a scrollable list."
---

# Display Tasks

Replace the empty state from [Create a Window](/v2/tutorial/your-first-window) with a list of tasks. Start with sample data; the next chapter adds editing.

## Define the task model

Create `src/types.ts`:

```ts [src/types.ts]
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

`title` appears in the list, `notes` holds the body shown in the editor, and `position` records the manual order. Dates use ISO strings so tasks can be saved as JSON in [Save Tasks](/v2/tutorial/saving-to-disk).

## Render the list

Create `src/components/task-list.tsx`:

```tsx [src/components/task-list.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwClamp } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Task } from "../types.js";

const createdAt = new Date().toISOString();

const TASKS: Task[] = [
    {
        id: "t1",
        listId: "personal",
        title: "Welcome to Tasks",
        notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
        done: false,
        important: false,
        deleted: false,
        due: null,
        position: 0,
        createdAt,
        completedAt: null,
    },
    {
        id: "t2",
        listId: "personal",
        title: "Water the plants",
        notes: "",
        done: false,
        important: true,
        deleted: false,
        due: null,
        position: 1,
        createdAt,
        completedAt: null,
    },
    {
        id: "t3",
        listId: "work",
        title: "Prepare the weekly report",
        notes: "",
        done: false,
        important: false,
        deleted: false,
        due: null,
        position: 2,
        createdAt,
        completedAt: null,
    },
];

export const TaskList = () => (
    <GtkScrolledWindow vexpand>
        <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
            <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                {TASKS.map((task) => (
                    <AdwActionRow key={task.id} title={task.title} subtitle={task.notes} useMarkup={false} />
                ))}
            </GtkListBox>
        </AdwClamp>
    </GtkScrolledWindow>
);
```

`GtkScrolledWindow` scrolls long lists. `AdwClamp` keeps the rows readable in a wide window, and the `boxed-list` class gives the list its rounded card appearance. [CSS](/v2/guide/css) covers native classes and stylesheets.

`selectionMode={Gtk.SelectionMode.NONE}` disables row selection because each task will have its own controls. JSX elements come from `@gtkx/jsx/gtk`; enums such as `Gtk.SelectionMode` come from `@gtkx/gi/gtk`.

`useMarkup={false}` displays task text literally. Use `task.id` as the key so rows retain their identity when reordered; React's [list rendering guide](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) explains stable keys.

## Show the list in the window

Replace `src/app.tsx` with the following. It keeps the window and header bar, removes the unused status-page import, and puts `TaskList` in the content slot.

```tsx [src/app.tsx]
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";
import { TaskList } from "./components/task-list.js";

export function App() {
    return (
        <AdwApplication>
            <AdwApplicationWindow
                title="Tasks"
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
            >
                <AdwToolbarView topBar={<AdwHeaderBar />}>
                    <TaskList />
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}
```

## Run it

The window shows three task titles in a card under the header bar. **Welcome to Tasks** has a second line of notes; the other rows have titles only.

Widen the window until the card stops growing and stays centered. Shorten it until the list scrolls. Add a fourth entry to `TASKS` with a unique `id` and title, check that it appears, then remove it before continuing.

## Next

[Add Tasks](/v2/tutorial/the-task-store) moves the sample data into a store and adds an entry row.
