import * as Gtk from "@gtkx/gi/gtk";

export type EditableTarget = Gtk.Editable | Gtk.TextView;

export const EDITABLE_ROLES: Set<Gtk.AccessibleRole> = new Set<Gtk.AccessibleRole>([
    Gtk.AccessibleRole.TEXT_BOX,
    Gtk.AccessibleRole.SEARCH_BOX,
    Gtk.AccessibleRole.SPIN_BUTTON,
]);

export const isEditable = (widget: unknown): widget is EditableTarget =>
    widget instanceof Gtk.Editable || widget instanceof Gtk.TextView;

export const getEditableDelegate = (widget: Gtk.Widget): Gtk.Widget | null => {
    if (!(widget instanceof Gtk.Editable)) return null;
    const delegate = widget.getDelegate();
    return delegate instanceof Gtk.Widget ? delegate : null;
};

const readTextViewBufferText = (widget: Gtk.TextView): string => {
    const buffer = widget.getBuffer();
    const [start, end] = buffer.getBounds();
    return buffer.getText(start, end, true);
};

export const readEditableText = (widget: EditableTarget): string => {
    if (widget instanceof Gtk.TextView) {
        return readTextViewBufferText(widget);
    }
    return widget.getText();
};
