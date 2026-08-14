---
description: "Collapse the split view to a single pane on a narrow window, with a back button that works."
---

# A Layout That Collapses

Your app shows a sidebar of lists beside the tasks for the selected one, built in [Lists and a Sidebar](/tutorial/lists-and-the-sidebar).

Drag the window edge inward and a problem shows. The `widthRequest={360}` you set in [Your First Window](/tutorial/your-first-window) lets the app shrink to a phone-sized width, but at 360 points a 220 point sidebar and a task list cannot sit side by side. The sidebar takes most of the window and the task column is too narrow to read.

Adwaita's answer is to stop showing both panes at once. Below a width you choose, the split view collapses to a single pane showing either the sidebar or the content, with a back button in the header to move between them. The widget can already do this. You need to tell it when to collapse and which pane to show.

## Fields for the collapse state

They describe what the interface is doing right now, so they belong in the UI slice, which `partialize` excludes so it starts fresh at every launch. A window that opened narrow last time should not force a narrow layout onto a wide window today.

In `src/store/ui.ts`, add the fields and their setters:

```ts
export type UiSlice = {
    selection: Selection;
    collapsed: boolean; // [!code ++]
    showContent: boolean; // [!code ++]
    select: (selection: Selection) => void;
    setCollapsed: (collapsed: boolean) => void; // [!code ++]
    setShowContent: (showContent: boolean) => void; // [!code ++]
};

export const createUiSlice: StateCreator<Store, Mutators, [], UiSlice> = (set) => ({
    selection: { kind: "list", listId: "personal" },
    collapsed: false, // [!code ++]
    showContent: false, // [!code ++]
    select: (selection) => set({ selection }), // [!code --]
    select: (selection) => set((state) => ({ selection, showContent: state.collapsed })), // [!code ++]
    setCollapsed: (collapsed) => set({ collapsed }), // [!code ++]
    setShowContent: (showContent) => set({ showContent }), // [!code ++]
});
```

`collapsed` is whether the layout is in one-pane mode. `showContent` is which pane that shows: `false` for the sidebar, `true` for the tasks.

The change to `select` matters here. With both panes visible, clicking a list should leave you looking at both, so `showContent` stays as it is. When the layout is collapsed, clicking a list is a navigation: you want that list's tasks, which live in the pane you cannot see. Setting `showContent` to the current value of `collapsed` does exactly that, so the component never needs to know which mode it is in.

Reading `state` inside `set` is how a zustand action derives its next state from the current one. The updater form of `set` receives the whole store, so a UI slice action can read `collapsed` and a tasks action can read `tasks`.

## The breakpoint

Adwaita expresses when to collapse as an `AdwBreakpoint`: a condition on the window's size, plus what to do when the condition starts and stops holding. It goes in the window's `breakpoints` slot, so it attaches to the window itself rather than joining its children.

In `src/components/window.tsx`, read the new fields and their setters, and add the slot:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwApplicationWindow, AdwBreakpoint, AdwNavigationSplitView } from "@gtkx/jsx/adw";
// ...

export const Window = () => {
    const collapsed = useStore((state) => state.collapsed);
    const showContent = useStore((state) => state.showContent);
    const setCollapsed = useStore((state) => state.setCollapsed);
    const setShowContent = useStore((state) => state.setShowContent);
    // ...

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

## Wiring the split view

The split view has both properties too. Pass them down, still in `src/components/window.tsx`:

```tsx
<AdwNavigationSplitView
    collapsed={collapsed}
    showContent={showContent}
    onNotifyShowContent={(value) => setShowContent(value ?? false)}
    sidebarWidthFraction={0.25}
    minSidebarWidth={220}
    maxSidebarWidth={300}
    sidebar={/* ... */}
>
    {/* ... */}
</AdwNavigationSplitView>
```

`collapsed` flows one way: the breakpoint decides, the store records, the widget follows. `showContent` does not, which is why the handler is there. Once collapsed, the split view shows a back button in the content header and responds to the system back gesture, and both change `show-content` inside GTK4 on their own. If that change never reaches the store, the next render passes the old `showContent` back down and the pane you navigated away from snaps into view.

This is the controlled-widget pairing you used for the completion checkbox in [Completing, Starring, and Deleting](/tutorial/completing-and-deleting): the value prop is one half, the matching notify signal is the other. Any GTK4 property you drive from the store needs its change reported back.

`onNotify*` handlers receive the new value first, typed as nullable because a GObject property read can come back unset, hence the `?? false`.

## Run it

Save both files, then grab the window's right edge and drag inward. Somewhere below 500 points wide the two panes become one: the sidebar fills the window and the task list is gone.

Click a list. The window navigates to that list's tasks, and the content header gets a back arrow on the left. Click it to return to the sidebar with the list still selected. Press <kbd>Alt</kbd> + <kbd>Left</kbd>, or swipe back on a touchpad, and the same happens: those go through GTK4 rather than your handler, which is the case `onNotifyShowContent` exists to catch.

Drag the window wide again. Both panes reappear side by side, and clicking a list changes the right pane while the sidebar stays visible.

## Next

[Smart Views, Filters, and Search](/tutorial/smart-views-and-search) derives All Tasks, Today, Important, and Trash from the tasks you already have.
