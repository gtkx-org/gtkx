import { initializeWrapper } from "@gtkx/runtime/internal";
import { ListBox, ListBoxRow, type Widget } from "@gtkx/gi/gtk";
import { PreferencesGroup, Sidebar } from "../adw.js";

type ModeState = { views: WeakRef<Widget>[] };
type ViewParts = { groups: PreferencesGroup[]; lists: ListBox[]; rows: ListBoxRow[] };

const widgetChildren = (widget: Widget): Widget[] => {
    const children: Widget[] = [];

    for (let child = widget.getFirstChild(); child !== null; child = child.getNextSibling()) {
        children.push(child);
    }

    return children;
};

const collectViewPart = (parts: ViewParts, widget: Widget): void => {
    if (widget instanceof PreferencesGroup) {
        parts.groups.push(widget);
    }

    if (widget instanceof ListBox) {
        parts.lists.push(widget);
    }

    if (widget instanceof ListBoxRow) {
        parts.rows.push(widget);
    }
};

const viewParts = (view: Widget): ViewParts => {
    const parts: ViewParts = { groups: [], lists: [], rows: [] };
    const pending = [view];

    for (let widget = pending.pop(); widget !== undefined; widget = pending.pop()) {
        collectViewPart(parts, widget);
        pending.push(...widgetChildren(widget));
    }

    return parts;
};

const disposeDetachedView = (view: Widget): void => {
    if (view.getParent() !== null) {
        return;
    }

    const parts = viewParts(view);

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

const changedMode =
    (receiver: WeakRef<Sidebar>, state: ModeState): (() => void) =>
    () => {
        const sidebar = receiver.deref();

        if (sidebar === undefined) {
            return;
        }

        const previous = state.views;
        state.views = sidebarViews(sidebar).map((view) => new WeakRef(view));

        for (const reference of previous) {
            const view = reference.deref();

            if (view !== undefined) {
                disposeDetachedView(view);
            }
        }
    };

/* TODO: Keep retired-view cleanup until libadwaita disconnects Sidebar models and suffixes on mode changes.
 * https://github.com/gtkx-org/gtkx/issues/726
 */
Object.defineProperty(Sidebar.prototype, initializeWrapper, {
    value: function (this: Sidebar): void {
        const state: ModeState = { views: sidebarViews(this).map((view) => new WeakRef(view)) };
        this.on("notify::mode", changedMode(new WeakRef(this), state));
    },
});
