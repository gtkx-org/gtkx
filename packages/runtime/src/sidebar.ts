import { onSignal } from "./listeners.js";
import { initializeWrapper } from "./wrapper-brand.js";

type Widget = {
    getFirstChild: () => Widget | null;
    getNextSibling: () => Widget | null;
    getParent: () => Widget | null;
    runDispose: () => void;
};
type ModelContainer = Widget & { bindModel: (model: null, createWidgetFunc: null) => void };
type ViewClasses = {
    PreferencesGroup: abstract new (...args: never[]) => ModelContainer;
    ListBox: abstract new (...args: never[]) => ModelContainer;
    ListBoxRow: abstract new (...args: never[]) => Widget;
};
type Sidebar = Widget & { getPlaceholder: () => Widget | null };
type ModeState = { views: WeakRef<Widget>[] };

type ViewParts = { groups: ModelContainer[]; lists: ModelContainer[]; rows: Widget[] };

const widgetChildren = (widget: Widget): Widget[] => {
    const children: Widget[] = [];

    for (let child = widget.getFirstChild(); child !== null; child = child.getNextSibling()) {
        children.push(child);
    }

    return children;
};

const collectViewPart = (parts: ViewParts, widget: Widget, classes: ViewClasses): void => {
    if (widget instanceof classes.PreferencesGroup) {
        parts.groups.push(widget);
    }

    if (widget instanceof classes.ListBox) {
        parts.lists.push(widget);
    }

    if (widget instanceof classes.ListBoxRow) {
        parts.rows.push(widget);
    }
};

const viewParts = (view: Widget, classes: ViewClasses): ViewParts => {
    const parts: ViewParts = { groups: [], lists: [], rows: [] };
    const pending = [view];

    for (let widget = pending.pop(); widget !== undefined; widget = pending.pop()) {
        collectViewPart(parts, widget, classes);
        pending.push(...widgetChildren(widget));
    }

    return parts;
};

const disposeDetachedView = (view: Widget, classes: ViewClasses): void => {
    if (view.getParent() !== null) {
        return;
    }

    const parts = viewParts(view, classes);

    for (const container of [...parts.groups, ...parts.lists]) {
        container.bindModel(null, null);
    }

    for (const row of parts.rows) {
        if (row.getParent() === null) {
            row.runDispose();
        }
    }
};

const sidebarViews = (sidebar: Sidebar): Widget[] => {
    const placeholder = sidebar.getPlaceholder();

    return widgetChildren(sidebar).filter((child) => child !== placeholder);
};

const changedMode = (
    receiver: WeakRef<Sidebar>,
    state: ModeState,
    classes: ViewClasses,
): (() => void) => () => {
    const sidebar = receiver.deref();

    if (sidebar === undefined) {
        return;
    }

    const previous = state.views;
    state.views = sidebarViews(sidebar).map((view) => new WeakRef(view));

    for (const reference of previous) {
        const view = reference.deref();

        if (view !== undefined) {
            disposeDetachedView(view, classes);
        }
    }
};

/* TODO: Keep retired-view cleanup until libadwaita disconnects Sidebar models and suffixes on mode changes.
 * https://github.com/gtkx-org/gtkx/issues/726
 */
function installSidebarModeOverride(prototype: Sidebar, classes: ViewClasses): void {
    Object.defineProperty(prototype, initializeWrapper, {
        value: function (this: Sidebar): void {
            const state: ModeState = { views: sidebarViews(this).map((view) => new WeakRef(view)) };
            onSignal(this, "notify::mode", changedMode(new WeakRef(this), state, classes));
        },
    });
}

export { installSidebarModeOverride };
