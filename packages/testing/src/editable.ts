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

export const getEditableDelegate = (widget: Gtk.Widget): Gtk.Widget | null => {
    if (!isEditable(widget)) return null;
    const delegate = widget.getDelegate();
    return delegate instanceof Gtk.Widget ? delegate : null;
};
