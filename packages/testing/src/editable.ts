import * as Gtk from "@gtkx/gi/gtk";

/**
 * The accessible roles whose widgets implement the `Gtk.Editable` text-entry contract.
 *
 * This set is the single source of truth for which widgets `userEvent` text helpers
 * (`type`, `clear`, `copy`, `cut`, `paste`) accept, and it drives the human-readable
 * "expected editable widget" error message.
 */
export const EDITABLE_ROLES: Set<Gtk.AccessibleRole> = new Set<Gtk.AccessibleRole>([
    Gtk.AccessibleRole.TEXT_BOX,
    Gtk.AccessibleRole.SEARCH_BOX,
    Gtk.AccessibleRole.SPIN_BUTTON,
]);

export const isEditable = (widget: unknown): widget is Gtk.Editable => {
    if (!(widget instanceof Gtk.Widget)) {
        return false;
    }

    return EDITABLE_ROLES.has(widget.getAccessibleRole());
};

export const implementsEditable = (widget: unknown): widget is Gtk.Editable =>
    isEditable(widget) && !(widget instanceof Gtk.TextView);

export const getEditableDelegate = (widget: Gtk.Widget): Gtk.Widget | null => {
    if (!implementsEditable(widget)) return null;
    const delegate = widget.getDelegate();
    return delegate instanceof Gtk.Widget ? delegate : null;
};
