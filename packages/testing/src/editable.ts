import * as Gtk from "@gtkx/gi/gtk";

type EditableTarget = Gtk.Editable | Gtk.TextView;

const EDITABLE_ROLES: Set<Gtk.AccessibleRole> = new Set<Gtk.AccessibleRole>([
    Gtk.AccessibleRole.TEXT_BOX,
    Gtk.AccessibleRole.SEARCH_BOX,
    Gtk.AccessibleRole.SPIN_BUTTON,
]);

const isEditable = (widget: unknown): widget is EditableTarget =>
    widget instanceof Gtk.Editable || widget instanceof Gtk.TextView;

const getEditableDelegate = (widget: Gtk.Widget): Gtk.Widget | null => {
    if (!(widget instanceof Gtk.Editable)) {
        return null;
    }

    return widget.getDelegate();
};

const readTextViewBufferText = (widget: Gtk.TextView): string => {
    const buffer = widget.getBuffer();
    const [start, end] = buffer.getBounds();

    return buffer.getText(start, end, true);
};

const readEditableText = (widget: EditableTarget): string => {
    if (widget instanceof Gtk.TextView) {
        return readTextViewBufferText(widget);
    }

    return widget.getText();
};

export { EDITABLE_ROLES, isEditable, getEditableDelegate, readEditableText, type EditableTarget };
