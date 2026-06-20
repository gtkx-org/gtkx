import * as Gtk from "@gtkx/gi/gtk";

const EDITABLE_ROLES = new Set<Gtk.AccessibleRole>([
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

/**
 * Whether the widget implements the `Gtk.Editable` interface — every
 * role-editable widget except `Gtk.TextView`, which reports the `TEXT_BOX`
 * accessible role yet edits through a `Gtk.TextBuffer` rather than the
 * `Gtk.Editable` delegate protocol, so its instances carry none of the
 * interface's methods (`getDelegate`, `getText`, …).
 */
export const implementsEditable = (widget: unknown): widget is Gtk.Editable =>
    isEditable(widget) && !(widget instanceof Gtk.TextView);

export const getEditableDelegate = (widget: Gtk.Widget): Gtk.Widget | null => {
    if (!implementsEditable(widget)) return null;
    const delegate = widget.getDelegate();
    return delegate instanceof Gtk.Widget ? delegate : null;
};
