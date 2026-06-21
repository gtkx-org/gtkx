import * as Gtk from "@gtkx/gi/gtk";

/**
 * A widget that accepts text entry: either a `Gtk.Editable` implementor or a `Gtk.TextView`.
 *
 * `Gtk.TextView` does not implement `Gtk.Editable` (it exposes `AccessibleText` and a buffer-based
 * API) yet is a first-class editable target, so it is admitted alongside `Gtk.Editable`.
 */
export type EditableTarget = Gtk.Editable | Gtk.TextView;

/**
 * The accessible roles whose widgets are treated as editable text-entry targets.
 *
 * This set drives the human-readable "expected editable widget" error message produced by the
 * `userEvent` text helpers (`type`, `clear`, `copy`, `cut`, `paste`).
 */
export const EDITABLE_ROLES: Set<Gtk.AccessibleRole> = new Set<Gtk.AccessibleRole>([
    Gtk.AccessibleRole.TEXT_BOX,
    Gtk.AccessibleRole.SEARCH_BOX,
    Gtk.AccessibleRole.SPIN_BUTTON,
]);

/**
 * Type guard narrowing `widget` to an {@link EditableTarget} via interface/type identity.
 *
 * @param widget - The value to test.
 * @returns `true` when `widget` is a `Gtk.Editable` implementor or a `Gtk.TextView`.
 */
export const isEditable = (widget: unknown): widget is EditableTarget =>
    widget instanceof Gtk.Editable || widget instanceof Gtk.TextView;

/**
 * Resolves the delegate widget backing a `Gtk.Editable`, when the editable delegates its text
 * entry to an inner widget. Non-editables, `Gtk.TextView`, and editables without a delegate yield
 * `null`.
 *
 * @param widget - The widget to inspect.
 * @returns The delegate widget, or `null` when there is none.
 */
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

/**
 * Reads the current text value of an {@link EditableTarget}, using the `Gtk.Editable` API for
 * editables and the backing buffer for a `Gtk.TextView`.
 *
 * @param widget - The editable target to read.
 * @returns The widget's text content.
 */
export const readEditableText = (widget: EditableTarget): string => {
    if (widget instanceof Gtk.TextView) {
        return readTextViewBufferText(widget);
    }
    return widget.getText();
};
