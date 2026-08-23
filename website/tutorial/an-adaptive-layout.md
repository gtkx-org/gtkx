---
description: "Collapse the split view to a single pane on a narrow window, and fill the content pane when nothing is selected."
---

# A Layout That Collapses

Your app shows a sidebar of lists beside the tasks for the selected one, built in [Lists and a Sidebar](/tutorial/lists-and-the-sidebar).

Drag the window edge inward and a problem shows. The `widthRequest={360}` you set in [Your First Window](/tutorial/your-first-window) lets the app shrink to a phone-sized width, but at 360 points a 220 point sidebar and a task list cannot sit side by side. The sidebar takes most of the window and the task column is too narrow to read.

Adwaita's answer is to stop showing both panes at once. Below a width you choose, the split view collapses to a single pane, and moving between the sidebar and the tasks becomes navigation, with a back button and the system back gesture behind it. The navigator already knows what that navigation is, since it is the same stack it has been managing all along. What is missing is the one thing only the window can answer: when the window is too narrow for two panes.

## A slice for the collapse state

Whether the layout is collapsed is not data you typed, and it is not a place. It is what the interface is doing right now, which is the third case from [Lists and a Sidebar](/tutorial/lists-and-the-sidebar), so it opens the UI slice. `partialize` excludes that slice, so it starts fresh at every launch: a window that opened narrow last time should not force a narrow layout onto a wide window today.

Create `src/store/ui.ts`:

```ts
import type { StateCreator } from "zustand";
import type { Mutators, Store } from "./index.js";

export type UiSlice = {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    collapsed: false,
    setCollapsed: (collapsed) => set({ collapsed }),
});
```

One field and its setter is a thin slice, and it stays that way for now. [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) adds the header filter and the search state to it, and [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts) adds which dialog is showing.

Compose it in `src/store/index.ts`:

```ts
import { createTasksSlice, type TasksSlice } from "./tasks.js";
import { createUiSlice, type UiSlice } from "./ui.js"; // [!code ++]

export type Store = TasksSlice & ListsSlice; // [!code --]
export type Store = TasksSlice & ListsSlice & UiSlice; // [!code ++]

// ...

        (...a) => ({
            ...createTasksSlice(...a),
            ...createListsSlice(...a),
            ...createUiSlice(...a), // [!code ++]
        }),
```

`PersistedState` and `partialize` do not change, which is the point: the new field is state the app has, not state the app keeps.

## The breakpoint

Adwaita expresses when to collapse as an `AdwBreakpoint`: a condition on the window's size, plus what to do when the condition starts and stops holding. It goes in the window's `breakpoints` slot, so it attaches to the window itself rather than joining its children.

In `src/components/window.tsx`, read the new field and its setter, and add the slot:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwApplicationWindow, AdwBreakpoint } from "@gtkx/jsx/adw";
// ...

export const Window = () => {
    const lists = useStore((state) => state.lists);
    const collapsed = useStore((state) => state.collapsed);
    const setCollapsed = useStore((state) => state.setCollapsed);

    return (
        <AdwApplicationWindow
            title="Tasks"
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
            breakpoints={
                <AdwBreakpoint
                    condition={Adw.BreakpointCondition.parse("max-width: 500sp")}
                    onApply={() => setCollapsed(true)}
                    onUnapply={() => setCollapsed(false)}
                />
            }
        >
            {/* ... */}
        </AdwApplicationWindow>
    );
};
```

`Adw.BreakpointCondition.parse` turns the string into the condition object the property wants. Adwaita parses it at runtime, so a typo surfaces in the terminal rather than in TypeScript.

The unit matters. `sp` is scale-independent pixels: it tracks the text scale factor, so when someone turns on Large Text the 500sp threshold grows with their text. A `px` threshold would keep collapsing at the same physical width even as the text grew. Measure adaptive thresholds in `sp`.

`onApply` fires when the window becomes narrow enough for the condition to hold, `onUnapply` when it stops. Each writes into the store, and every component reading `collapsed` follows.

## Handing the navigator the collapse state

The navigator takes it as a prop, still in `src/components/window.tsx`:

```tsx
<Split.Navigator
    initialRouteName="Tasks"
    collapsed={collapsed} // [!code ++]
    sidebarWidthFraction={0.25}
    minSidebarWidth={220}
    maxSidebarWidth={300}
>
    {/* ... */}
</Split.Navigator>
```

That is the whole wiring, and it runs in one direction: the breakpoint decides, the store records, the navigator follows. Nothing else ever writes `collapsed`, so nothing has to report it back.

Which pane is showing is a separate question, and it is not a second copy of anything. The content pane is showing exactly when the content stack has a page on it, so the navigator derives that from its own state and hands it to the split view. The back button, <kbd>Alt</kbd> + <kbd>Left</kbd>, and the swipe gesture all pop that stack, and when the split view gives its content up on its own the navigator hears it and pops to match.

This is the reverse of the controlled-widget pairing you wrote for the completion checkbox in [Completing, Starring, and Deleting](/tutorial/completing-and-deleting). There the widget owned a fact you also kept, so the value prop needed the matching notify signal beside it. Here a single owner holds both halves, so there is no second copy to keep in agreement and nothing for you to catch.

## When nothing is selected

Side by side, the content pane always has the task list on it. The stack inside that pane is an `AdwNavigationView`, and a navigation view refuses to pop its only page, so nothing the user presses can empty it.

Collapsed, that changes. libadwaita holds both panes in one navigation view, so going back from the task list lands on the sidebar, and that move pops the content stack empty. Widen the window from there and the content pane has nothing to show.

`contentPlaceholder` is what fills it, and `AdwStatusPage` is the empty state that filled the whole window in [Your First Window](/tutorial/your-first-window): an icon, a title, and a line of explanation, centered in whatever space it is given.

Above `Window`, in `src/components/window.tsx`:

```tsx
import { AdwApplicationWindow, AdwBreakpoint } from "@gtkx/jsx/adw"; // [!code --]
import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage } from "@gtkx/jsx/adw"; // [!code ++]
// ...

const NothingSelected = () => ( // [!code ++]
    <AdwStatusPage // [!code ++]
        iconName="view-list-symbolic" // [!code ++]
        title="Nothing Selected" // [!code ++]
        description="Pick a list or a smart view in the sidebar" // [!code ++]
    /> // [!code ++]
); // [!code ++]
```

The wording looks one chapter ahead: [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) puts All Tasks, Today, Important, and Trash in the sidebar beside your lists, and any of them can be what fills the pane.

Then hand it to the navigator:

```tsx
<Split.Navigator
    initialRouteName="Tasks"
    collapsed={collapsed}
    sidebarWidthFraction={0.25}
    minSidebarWidth={220}
    maxSidebarWidth={300}
    contentPlaceholder={<NothingSelected />} // [!code ++]
>
    {/* ... */}
</Split.Navigator>
```

An empty content stack means there is no `Tasks` route to read params from, so `useSelection` returns `null`, which is why it was typed that way. Nothing is selected, so no sidebar row should be highlighted.

`src/components/sidebar.tsx` needs no edit for that. `lists.findIndex` answers `-1` when there is no selection to match, and `-1` is exactly what `selectedIndex` reads as *no row*, so the highlight clears itself when the content pane empties and returns when you pick a list again. That is the payoff of writing the selection as a prop in [Lists and a Sidebar](/tutorial/lists-and-the-sidebar): a case you wrote no code for is one the prop already has a meaning for. The clearing is gtkx's own write, so its `row-selected` is suppressed like every other one and cannot bounce back as a navigation.

## Run it

Save, then grab the window's right edge and drag inward. Somewhere below 500 points wide the two panes become one, showing the task list with a back arrow in its header. `initialRouteName="Tasks"` puts a page on the content stack at startup, so a narrow window opens on the tasks rather than on the sidebar.

Click the back arrow and you are on the sidebar, in one press, with no empty pane in between. Press <kbd>Escape</kbd>, or <kbd>Alt</kbd> + <kbd>Left</kbd>, or swipe back on a touchpad, and the same thing happens. None of those go through code of yours.

Click a list. The window navigates to that list's tasks, and the back arrow is there again.

Go back to the sidebar once more and drag the window wide. Both panes reappear, the sidebar has no row highlighted, and the content pane reads **Nothing Selected**: you left the content stack empty, and widening the window does not put anything back on it. Click any list and the placeholder gives way to that list's tasks.

## Next

[Smart Views, Filters, and Search](/tutorial/smart-views-and-search) derives All Tasks, Today, Important, and Trash from the tasks you already have.
