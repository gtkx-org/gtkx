import { getInterface } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import { Accessible, AccessibleRole } from "@gtkx/ffi/gtk";

const EDITABLE_ROLES = new Set([AccessibleRole.TEXT_BOX, AccessibleRole.SEARCH_BOX, AccessibleRole.SPIN_BUTTON]);

/**
 * Checks if a widget has an editable accessible role (text box, search box, or spin button).
 */
export const isEditable = (widget: Gtk.Widget): boolean => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible) return false;
    return EDITABLE_ROLES.has(accessible.getAccessibleRole());
};

const LABEL_ROLES = new Set([
    AccessibleRole.BUTTON,
    AccessibleRole.TOGGLE_BUTTON,
    AccessibleRole.CHECKBOX,
    AccessibleRole.RADIO,
    AccessibleRole.LABEL,
    AccessibleRole.MENU_ITEM,
    AccessibleRole.MENU_ITEM_CHECKBOX,
    AccessibleRole.MENU_ITEM_RADIO,
]);

/**
 * Checks if a widget has an accessible role that supports labels.
 */
export const hasLabel = (widget: Gtk.Widget): boolean => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible) return false;
    return LABEL_ROLES.has(accessible.getAccessibleRole());
};
