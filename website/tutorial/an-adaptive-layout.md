---
title: "Adaptive Navigation and Editing"
description: "Connect lists, task details, breakpoints, and a typed native form."
---

# Adaptive Navigation and Editing

Tasks has a master list and detail pages. `@gtkx/navigation` renders that structure with native libadwaita widgets, while `@gtkx/forms` keeps drafts and validation separate from saved task state.

```bash
npm install @gtkx/navigation @gtkx/forms
```

## Define routes once

```ts
import type { Selection } from "./types.js";

type RootParamList = {
    Lists: undefined;
    Tasks: Selection;
    Task: { id: string };
};
```

Create a split-view navigator with `Lists` as the master screen and `Tasks` plus `Task` as detail routes. The finished route definitions are in [`navigation.ts`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/navigation.ts).

Drive the navigator's `collapsed` prop from an `AdwBreakpoint`. Wide windows show both panes; narrow windows turn the same routes into a native push/pop flow. Do not build separate mobile and desktop trees.

## Keep route params small

Pass stable IDs, not task objects. Each screen selects the current value from the store, so edits, restores, and deletes remain visible everywhere. If an ID no longer resolves, navigate back or render a compact missing-state page.

The list screen owns filtering and search presentation. Selector functions own which tasks match All, Today, Important, a user list, or Trash. This keeps header counts, empty states, and displayed rows consistent.

## Edit a draft

Initialize a React Hook Form from the selected task. Save title changes on submission and update independent controls, such as importance, through explicit store operations.

```tsx
type TaskFields = Pick<Task, "important" | "title">;

const form = useForm<TaskFields>({
    defaultValues: { important: task.important, title: task.title },
});

const saveTitle = form.handleSubmit(({ title }) => updateTask(task.id, { title }));
```

GTK buttons do not submit HTML forms, so call the function returned by `handleSubmit`. Reset the form when the route selects a different task. The complete screen is in [`task-detail.tsx`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/components/task-detail.tsx).

## Native behavior to keep

- Let the navigator supply Back, Escape, Alt+Left, and swipe behavior.
- Use `headerStart` and `headerEnd` only for screen-specific controls.
- Confirm destructive actions before permanently deleting a trashed task.
- Show reversible deletion with an `AdwToastOverlay`; keep the domain operation in the store.
- Use accessible names for icon-only row and header buttons.

Verify both a wide and narrow window before continuing to [application actions and desktop integration](/tutorial/actions-menus-shortcuts).
