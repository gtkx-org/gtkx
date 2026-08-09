import type * as Gtk from "@gtkx/gi/gtk";

const CHILD_AT_INDEX_GETTERS = ["getRowAtIndex", "getChildAtIndex"];
const CHILD_SELECTORS = ["selectRow", "selectChild"];
const CHILD_DESELECTORS = ["unselectRow", "unselectChild"];
const SELECTED_PROBE = "isSelected";

const getWidgetMethod = (widget: Gtk.Widget, name: string): unknown => Reflect.get(widget, name);

const hasWidgetMethod = (widget: Gtk.Widget, name: string): boolean =>
    typeof getWidgetMethod(widget, name) === "function";

const hasIndexedChildren = (widget: Gtk.Widget): boolean =>
    CHILD_AT_INDEX_GETTERS.some((getter) => hasWidgetMethod(widget, getter));

const getChildAtIndex = (widget: Gtk.Widget, index: number): Gtk.Widget | null => {
    for (const getter of CHILD_AT_INDEX_GETTERS) {
        const fn = getWidgetMethod(widget, getter);

        if (typeof fn === "function") {
            return (fn as (position: number) => Gtk.Widget | null).call(widget, index) ?? null;
        }
    }

    return null;
};

const applyChildMethod = (container: Gtk.Widget, names: string[], child: Gtk.Widget): void => {
    for (const name of names) {
        const fn = getWidgetMethod(container, name);

        if (typeof fn === "function") {
            (fn as (target: Gtk.Widget) => void).call(container, child);

            return;
        }
    }
};

const selectContainerChild = (container: Gtk.Widget, child: Gtk.Widget): void => {
    applyChildMethod(container, CHILD_SELECTORS, child);
};

const unselectContainerChild = (container: Gtk.Widget, child: Gtk.Widget): void => {
    applyChildMethod(container, CHILD_DESELECTORS, child);
};

const isChildSelected = (child: Gtk.Widget): boolean => {
    const fn = getWidgetMethod(child, SELECTED_PROBE);

    return typeof fn === "function" && (fn as () => boolean).call(child);
};

export {
    getChildAtIndex,
    hasIndexedChildren,
    hasWidgetMethod,
    isChildSelected,
    SELECTED_PROBE,
    selectContainerChild,
    unselectContainerChild,
};
