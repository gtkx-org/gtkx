import type * as Gtk from "@gtkx/gi/gtk";
import * as GLib from "@gtkx/gi/glib";
import { callBooleanGetter, hasWidgetMethod } from "../widget-getters.js";

const SELECT_ACTION = "listitem.select";
const SINGLE_CLICK_ACTIVATE_GETTER = "getSingleClickActivate";
const DOUBLE_CLICK_PRESS = 2;

const viewFor = (row: Gtk.Widget): Gtk.Widget | null => {
    let current: Gtk.Widget | null = row.getParent();

    while (current !== null) {
        if (hasWidgetMethod(current, SINGLE_CLICK_ACTIVATE_GETTER)) {
            return current;
        }

        current = current.getParent();
    }

    return null;
};

const isViewSingleClickActivating = (row: Gtk.Widget): boolean => {
    const view = viewFor(row);

    return view === null ? false : callBooleanGetter(view, SINGLE_CLICK_ACTIVATE_GETTER) ?? false;
};

const selectRow = (row: Gtk.Widget): void => {
    row.activateAction(
        SELECT_ACTION,
        GLib.Variant.newTuple([GLib.Variant.newBoolean(false), GLib.Variant.newBoolean(false)]),
    );
};

const isRowActivatedByPress = (row: Gtk.Widget, press: number): boolean =>
    press === DOUBLE_CLICK_PRESS || isViewSingleClickActivating(row);

const applyRowPress = (row: Gtk.Widget, press: number): void => {
    if (row.getFocusOnClick()) {
        row.grabFocus();
    }

    selectRow(row);

    if (isRowActivatedByPress(row, press)) {
        row.activate();
    }
};

const applyRowClick = (row: Gtk.Widget, nPress: number): void => {
    for (let press = 1; press <= nPress; press++) {
        applyRowPress(row, press);
    }
};

export { applyRowClick };
