# The Application Shell

Everything the app renders lives inside one `AdwApplicationWindow`. There is no router, no second window, no page stack you push and pop. Instead `app.tsx` builds a fixed adaptive frame (an application, a window, a split view, two toolbar views) and then swaps what fills the content pane purely from React state. This page walks that frame top to bottom: how the GTK application and window are declared, how window size is persisted on close, how the layout collapses to a phone-width single column, and why the detail/list/selection swap is driven by state rather than by GTK's own navigation stack.

The file defines two components. `App` is the exported application root and the home of app-scoped actions; `TasksWindow` is a local component holding the single window and all of the UI state. Everything else in the tutorial hangs off this shell.

## The application root

The outermost element is `<AdwApplication>`. It is a real component from `@gtkx/jsx/adw`, not a wrapper you configure imperatively: mounting it calls `adw_init`, owns the `AdwStyleManager`, and provides the `Gtk.Application` that `useApplication()` reads from anywhere in the tree.

```tsx
export function App() {
    const notify = useRef<NotifyHandlers>({ complete: () => {}, open: () => {} });
    return (
        <AdwApplication
            actionAccels={[
                { detailedActionName: "win.new", accels: ["<Control>n"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
            ]}
        >
            <GSimpleAction
                name="complete-task"
                parameterType={GLib.VariantType.new("s")}
                onActivate={(parameter) => {
                    if (parameter) notify.current.complete(parameter.getString()[0]);
                }}
            />
            <GSimpleAction
                name="open-task"
                parameterType={GLib.VariantType.new("s")}
                onActivate={(parameter) => {
                    if (parameter) notify.current.open(parameter.getString()[0]);
                }}
            />
            <TasksWindow notify={notify} />
        </AdwApplication>
    );
}
```

`actionAccels` is a declarative list prop. Each entry is `{ detailedActionName, accels }` and becomes one `gtk_application_set_accels_for_action` call, binding a keyboard accelerator to an action by name. The `win.` prefix means these accelerators fire actions installed on the **window** (`<GSimpleAction name="new">`, `preferences`, `shortcuts` live in the window's `actions` slot, covered on the actions page). So `Ctrl+N` triggers `win.new`, `Ctrl+,` opens preferences, `Ctrl+?` opens the shortcuts window, all wired from this one array.

The two `<GSimpleAction>` children of `<AdwApplication>` are different: placed directly under the application, they register as **app-scoped** actions (`app.complete-task`, `app.open-task`) through the application's action map. They exist so desktop notification buttons can call back into the running app. Each declares `parameterType={GLib.VariantType.new("s")}`, meaning it takes a single string (a task id), which the handler pulls out with `parameter.getString()[0]`.

Because the actions live at the application level but need to mutate window state, they route through a `notify` ref instead of calling into `TasksWindow` directly. `App` creates the ref, the two handlers read `notify.current.complete` / `notify.current.open`, and `TasksWindow` keeps `notify.current` pointed at live closures over its own state. This bridge is explained in full on the reminders/notifications page.

## The window

`TasksWindow` renders a single `<AdwApplicationWindow>`. This is an Adwaita window: freeform (no separate title bar; the header bars live inside the content), and it takes its child content through the `content` object prop, which the children here route into automatically.

```tsx
return (
    <AdwApplicationWindow
        ref={windowRef}
        title="Tasks"
        defaultWidth={winWidth}
        defaultHeight={winHeight}
        widthRequest={360}
        heightRequest={294}
        onCloseRequest={handleClose}
        actions={<WindowActions /* new, select, preferences, shortcuts, about */ />}
        controllers={<AppShortcuts /* Ctrl+F, Escape, Delete */ />}
    >
        {/* ...toast overlay + split view... */}
    </AdwApplicationWindow>
);
```

A few things worth calling out for a GTK newcomer:

- **`ref={windowRef}`** gives you the live `Adw.ApplicationWindow` instance (`useRef<Adw.ApplicationWindow | null>(null)`). You need it to read the window's current pixel size on close and to attach the breakpoint below.
- **`defaultWidth` / `defaultHeight`** are seeded from GSettings, not hardcoded: `const [winWidth, setWinWidth] = useSetting(schema, "window-width")`. The window opens at whatever size it was last closed.
- **`widthRequest={360}` and `heightRequest={294}`** set the minimum window size. This is the GNOME phone-form-factor floor: the app is guaranteed to work down to a 360x294 window, which is what forces the layout to prove it collapses gracefully.
- **`actions`** and **`controllers`** are `ReactNode` slots present on every window/widget. `actions` holds `<GSimpleAction>` elements (the `win.*` actions the accelerators above target); `controllers` holds event controllers like the global shortcut controller. Both are detailed on the actions and shortcuts page.

### Persisting window size on close

`onCloseRequest` maps to the GTK `close-request` signal. The handler is the last thing that runs before the app exits, which makes it the right place to snapshot window geometry and flush unsaved data.

```tsx
const handleClose = (): boolean => {
    const window = windowRef.current;
    if (window) {
        const width = window.getWidth();
        const height = window.getHeight();
        if (width > 0) setWinWidth(width);
        if (height > 0) setWinHeight(height);
    }
    api.flush();
    return quit();
};
```

It reads the live size straight off the GTK widget with `getWidth()` / `getHeight()` (guarding against the transient `0` GTK can report mid-teardown), writes both back through the GSettings setters, flushes any pending task writes with `api.flush()`, and then returns `quit()`. `quit()` from `@gtkx/react` unmounts every active render root, which disposes the window and ends the app. This is the standard gtkx close handler; the geometry and flush steps are the app-specific additions.

## The toast overlay

Immediately inside the window is an `<AdwToastOverlay>`. It wraps the entire layout and holds nothing of its own except a ref:

```tsx
<AdwToastOverlay ref={toastOverlayRef}>
    {/* the split view */}
</AdwToastOverlay>
```

Toasts are added imperatively, not declaratively: `toastOverlayRef.current?.addToast(Adw.Toast.new(...))`. That is how the undo affordance works, for example when a task is trashed the handler builds a toast with an "Undo" button and pushes it onto the overlay. The overlay lives here at the top of the shell so any handler in the window can reach it through the ref. The undo flow itself is covered on the task-list page.

## The adaptive split view

The body of the window is a single `<AdwNavigationSplitView>`. This is the adaptive master/detail container: on a wide screen it shows the sidebar and content side by side; when collapsed it becomes a single column that navigates between them.

```tsx
<AdwNavigationSplitView
    collapsed={collapsed}
    showContent={showContent}
    onNotifyShowContent={(value) => setShowContent(value ?? false)}
    sidebarWidthFraction={0.25}
    minSidebarWidth={220}
    maxSidebarWidth={300}
    sidebar={
        <AdwNavigationPage title="Tasks">
            <AdwToolbarView topBar={<AdwHeaderBar start={/* New List button */} />}>
                <Sidebar lists={lists} counts={counts} selection={selection} onSelect={selectSidebar} />
            </AdwToolbarView>
        </AdwNavigationPage>
    }
    content={
        <AdwNavigationPage title={titleFor(selection, lists)}>
            <AdwToolbarView topBar={topBar} bottomBar={selecting ? selectionActionBar : undefined} revealBottomBars={selecting}>
                {contentBody}
            </AdwToolbarView>
        </AdwNavigationPage>
    }
/>
```

`sidebar` and `content` are object-slot props: each takes a single `<AdwNavigationPage>` element (the page is the unit the split view navigates between). The sizing props tune the sidebar: `sidebarWidthFraction={0.25}` asks for a quarter of the window, clamped between `minSidebarWidth={220}` and `maxSidebarWidth={300}` logical pixels.

The two props that make it adaptive are `collapsed` and `showContent`, both controlled from React state:

- **`collapsed`** decides whether the two panes are side by side (`false`) or stacked into one column (`true`). It is driven by the breakpoint below.
- **`showContent`** only matters when collapsed: it decides whether the visible column is the sidebar or the content. `onNotifyShowContent` mirrors the widget's own changes (a swipe-back, for instance) back into React state with `(value) => setShowContent(value ?? false)`, so the two never drift. When a task or a sidebar entry is opened while collapsed, the handlers set `setShowContent(true)` to push the content into view.

Each pane wraps its content in an `<AdwToolbarView>`, which gives you a header bar pinned to the top (`topBar`) and, on the content side, an optional action bar pinned to the bottom (`bottomBar`, revealed via `revealBottomBars` during selection mode). The content pane's `AdwNavigationPage` title is computed from the current selection with `titleFor(selection, lists)`, so the header reads "Today", "Important", or a user list's name.

## The imperative breakpoint

The split view collapses at a threshold, and that threshold is an `AdwBreakpoint`. In pure GTK a breakpoint is added to a window and, when its condition matches, applies setters and emits `apply` / `unapply`. gtkx does have a declarative `<AdwBreakpoint>` host component, but there is not yet a declarative container that attaches one to a window and configures which property it drives. So the shell reaches for the imperative escape hatch: it creates the breakpoint by hand and connects its signals with `useSignal`.

```tsx
const [breakpoint, setBreakpoint] = useState<Adw.Breakpoint | null>(null);

useEffect(() => {
    const window = windowRef.current;
    if (!window || breakpoint) return;
    const created = Adw.Breakpoint.new(Adw.BreakpointCondition.parse("max-width: 500sp"));
    window.addBreakpoint(created);
    setBreakpoint(created);
}, [breakpoint]);

useSignal(breakpoint, "apply", () => setCollapsed(true));
useSignal(breakpoint, "unapply", () => setCollapsed(false));
```

The effect runs once the window ref is populated: it parses the condition `max-width: 500sp`, creates the breakpoint, attaches it with `window.addBreakpoint`, and stores it in state. The guard `if (!window || breakpoint) return` makes it a one-shot; the `breakpoint` dependency re-runs it only until the breakpoint exists.

The condition uses `sp` units rather than raw pixels. `sp` (scalable pixels) tracks the text scale factor, so the collapse point widens automatically when the user turns on Large Text. Below 500sp the layout goes single-column; above it, side by side.

The interesting part is `useSignal(breakpoint, "apply", ...)`. On the first render `breakpoint` is `null`, because the effect that creates it has not run yet. `useSignal` accepts a nullish target and simply stays inert: no connection is made, no error is thrown. When the effect later calls `setBreakpoint(created)`, the component re-renders, `useSignal` sees a real `Adw.Breakpoint`, and connects `apply` / `unapply` then. Those handlers flip the `collapsed` state, which flows back into the split view's `collapsed` prop. GTK reports the layout threshold; React owns whether the app is in its collapsed mode.

## The controlled content swap

The content pane never pushes or pops pages. Its `AdwNavigationPage` is fixed; what changes is the `topBar` and the body inside the toolbar view, both selected from state.

```tsx
const contentBody = selectedTask ? (
    <TaskDetail key={selectedTask.id} task={selectedTask} /* ... */ />
) : selecting ? (
    <SelectionView tasks={visible} selectedIds={selectedIds} onSelectionChanged={setSelectedIds} />
) : (
    <TaskList tasks={visible} /* ...search, row handlers, empty state... */ />
);

const topBar = detailHeader ?? (selecting ? selectionHeader : listHeader);
```

Three states, three bodies: a task is open (the editor), selection mode is active (the batch-select list), or neither (the ordinary task list). The header is chosen the same way, and always in lockstep with the body, `detailHeader` when a task is open, the selection header when selecting, the list header otherwise. The detail header is a plain `AdwHeaderBar` with a `go-previous-symbolic` back button that just calls `setSelectedTaskId(null)`:

```tsx
const detailHeader = selectedTask ? (
    <AdwHeaderBar
        start={<GtkButton iconName="go-previous-symbolic" tooltipText="Back" onClicked={() => setSelectedTaskId(null)} />}
        end={/* important toggle + delete */}
    />
) : null;
```

This is a deliberate design choice. GTK offers `AdwNavigationView`, which manages its own page stack and would give you a back button, Escape handling, and edge-swipe for free. The shell does not use it inside the content pane. The reason is state ownership: an `AdwNavigationView` keeps the "which page is showing" truth **inside the widget**, so its own back gestures, Escape, and swipes mutate that stack behind React's back. You would then have to mirror every `pushed` / `popped` back into React state to keep the rest of the UI (headers, actions, the selection mode) consistent, and reconcile the two whenever they disagree.

The controlled swap sidesteps all of that. `selectedTaskId` and `selecting` are ordinary React state and the single source of truth. `contentBody` and `topBar` are pure functions of that state, recomputed together on every render, so the header can never show the detail bar while the body shows the list. Opening a task is `setSelectedTaskId(id)`; going back is `setSelectedTaskId(null)`. The result is reliable and easy to reason about, at the cost of hand-rolling one back button.

Note this is not a wholesale rejection of GTK navigation: the sidebar-to-content transition when collapsed still uses `AdwNavigationSplitView`'s built-in two-pane navigation, driven through the controlled `showContent` prop. The shell leans on GTK's navigation where it is a clean two-state toggle, and hand-controls the three-way content swap where an imperative stack would fight React.

## Next

Continue to **The Sidebar**.
