import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { ancestors } from "../traversal.js";
import { callBooleanGetter, hasWidgetMethod } from "../widget-getters.js";

const SELECT_ACTION = "listitem.select";
const SINGLE_CLICK_ACTIVATE_GETTER = "getSingleClickActivate";
const DOUBLE_CLICK_PRESS = 2;

const viewFor = (row: Gtk.Widget): Gtk.Widget | null => {
    for (const ancestor of ancestors(row)) {
        if (hasWidgetMethod(ancestor, SINGLE_CLICK_ACTIVATE_GETTER)) {
            return ancestor;
        }
    }

    return null;
};

const isViewSingleClickActivating = (row: Gtk.Widget): boolean => {
    const view = viewFor(row);

    return view !== null && (callBooleanGetter(view, SINGLE_CLICK_ACTIVATE_GETTER) ?? false);
};

const hasModifier = (modifiers: Gdk.ModifierType, mask: Gdk.ModifierType): boolean => (modifiers & mask) !== 0;

const selectRow = (row: Gtk.Widget, modifiers: Gdk.ModifierType): void => {
    const modify = hasModifier(modifiers, Gdk.ModifierType.CONTROL_MASK);
    const extend = hasModifier(modifiers, Gdk.ModifierType.SHIFT_MASK);

    row.activateAction(
        SELECT_ACTION,
        GLib.Variant.newTuple([GLib.Variant.newBoolean(modify), GLib.Variant.newBoolean(extend)]),
    );
};

const isRowActivatedByPress = (row: Gtk.Widget, press: number): boolean =>
    press === DOUBLE_CLICK_PRESS || isViewSingleClickActivating(row);

const applyRowPress = (row: Gtk.Widget, press: number, modifiers: Gdk.ModifierType): void => {
    if (row.getFocusOnClick()) {
        row.grabFocus();
    }

    selectRow(row, modifiers);

    if (isRowActivatedByPress(row, press)) {
        Gtk.Widget.prototype.activate.call(row);
    }
};

const applyRowClick = (row: Gtk.Widget, nPress: number, modifiers: Gdk.ModifierType): void => {
    for (let press = 1; press <= nPress; press++) {
        applyRowPress(row, press, modifiers);
    }
};

export { applyRowClick };
