---
description: "Model a task and display sample data in a scrollable list."
---

# Display Tasks

Replace the empty state from [Create a Window](/v2/tutorial/your-first-window) with a list of tasks. Start with sample data; the next chapter adds an entry row for new tasks.

## Define the task model

Create `src/types.ts`:

<<< @/figures/tutorial/a-list-of-tasks/src/types.ts [src/types.ts]

`title` appears in the list, `notes` holds the body shown in the editor, and `position` records the manual order. Dates use ISO strings so tasks can be saved as JSON in [Save Tasks](/v2/tutorial/saving-to-disk).

## Render the list

Create `src/components/task-list.tsx`:

<<< @/figures/tutorial/a-list-of-tasks/src/components/task-list.tsx [src/components/task-list.tsx]

`GtkScrolledWindow` scrolls long lists. `AdwClamp` keeps the rows readable in a wide window, and the `boxed-list` class gives the list its rounded card appearance. `valign={Gtk.Align.START}` keeps the card as tall as its rows; without it, the list fills the scrolled area. [CSS](/v2/guide/css) covers native classes and stylesheets.

`selectionMode={Gtk.SelectionMode.NONE}` disables row selection because each task will have its own controls. JSX elements come from `@gtkx/jsx/gtk`; enums such as `Gtk.SelectionMode` come from `@gtkx/gi/gtk`.

`useMarkup={false}` displays task text literally. Use `task.id` as the key so rows retain their identity when reordered; React's [list rendering guide](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) explains stable keys.

## Show the list in the window

Replace `src/app.tsx` with the following. It keeps the window and header bar, removes the unused status-page import, and puts `TaskList` in the content slot.

<<< @/figures/tutorial/a-list-of-tasks/src/app.tsx [src/app.tsx]

## Run it

The window shows three task titles in a card under the header bar. **Welcome to Tasks** has a second line of notes; the other rows have titles only.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-a-list-of-tasks-light.png" width="360" height="294" loading="lazy" alt="The Tasks window: a boxed list under the header bar with three tasks, Welcome to Tasks with a line of notes below it, Water the plants, and Prepare the weekly report." />
    <img class="result-dark" src="/figures/tutorial-a-list-of-tasks-dark.png" width="360" height="294" loading="lazy" alt="The Tasks window: a boxed list under the header bar with three tasks, Welcome to Tasks with a line of notes below it, Water the plants, and Prepare the weekly report." />
    <figcaption>Captured from <a href="#render-the-list"><code>src/components/task-list.tsx</code></a> and <a href="#show-the-list-in-the-window"><code>src/app.tsx</code></a> above.</figcaption>
</figure>

Widen the window until the card stops growing and stays centered. Shorten it until the list scrolls. Add a fourth entry to `TASKS` with a unique `id` and title, check that it appears, then remove it before continuing.

## Next

[Add Tasks](/v2/tutorial/the-task-store) moves the sample data into a store and adds an entry row.
