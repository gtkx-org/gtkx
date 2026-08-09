import type * as Gtk from "@gtkx/gi/gtk";
import { callBooleanGetter, getCallableMethod, hasWidgetMethod } from "../widget-getters.js";

const CHILD_AT_INDEX_GETTERS = ["getRowAtIndex", "getChildAtIndex"];
const CHILD_SELECTORS = ["selectRow", "selectChild"];
const CHILD_DESELECTORS = ["unselectRow", "unselectChild"];
const SELECTED_PROBE = "isSelected";

const hasIndexedChildren = (widget: Gtk.Widget): boolean =>
    CHILD_AT_INDEX_GETTERS.some((getter) => hasWidgetMethod(widget, getter));

const getChildAtIndex = (widget: Gtk.Widget, index: number): Gtk.Widget | null => {
    for (const getter of CHILD_AT_INDEX_GETTERS) {
        const fn = getCallableMethod<[number], Gtk.Widget | null>(widget, getter);

        if (fn) {
            return fn(index) ?? null;
        }
    }

    return null;
};

const applyChildMethod = (container: Gtk.Widget, names: string[], child: Gtk.Widget): void => {
    for (const name of names) {
        const fn = getCallableMethod<[Gtk.Widget], unknown>(container, name);

        if (fn) {
            fn(child);

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

const isChildSelected = (child: Gtk.Widget): boolean => callBooleanGetter(child, SELECTED_PROBE) ?? false;

const unselectOtherChildren = (container: Gtk.Widget, child: Gtk.Widget): void => {
    let index = 0;
    let candidate = getChildAtIndex(container, index);

    while (candidate !== null) {
        if (candidate !== child && isChildSelected(candidate)) {
            unselectContainerChild(container, candidate);
        }

        index++;
        candidate = getChildAtIndex(container, index);
    }
};

export {
    getChildAtIndex,
    hasIndexedChildren,
    isChildSelected,
    SELECTED_PROBE,
    selectContainerChild,
    unselectContainerChild,
    unselectOtherChildren,
};
