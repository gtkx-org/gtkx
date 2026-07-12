import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { EDITABLE_ROLES, type EditableTarget, getEditableDelegate, isEditable } from "../editable.js";
import { formatRoleList } from "../role-helpers.js";
import { wrapEvent } from "./event-wrapper.js";

/** Options for {@link type}. */
export type TypeOptions = {
    /** Do not focus the widget before typing. */
    skipClick?: boolean | undefined;
    /** Select from this offset before typing, replacing the selected range with the typed text. */
    initialSelectionStart?: number | undefined;
    /** End offset of the initial selection (defaults to the start offset). */
    initialSelectionEnd?: number | undefined;
};

const EDITABLE_REQUIRED = `expected editable widget (${formatRoleList(EDITABLE_ROLES)})`;

const insertEditableText = (widget: EditableTarget, text: string): void => {
    if (widget instanceof Gtk.TextView) {
        widget.emit("insert-at-cursor", text);
        return;
    }
    const target = getEditableDelegate(widget) ?? widget;
    if (target instanceof Gtk.Text) {
        target.emit("insert-at-cursor", text);
        return;
    }

    const position = widget.getPosition();
    const newPosition = widget.insertText(text, text.length, position);
    widget.setPosition(newPosition);
};

const readSelection = (widget: EditableTarget): string => {
    if (widget instanceof Gtk.TextView) {
        const buffer = widget.getBuffer();
        const [hasSelection, start, end] = buffer.getSelectionBounds();
        return hasSelection ? buffer.getText(start, end, true) : "";
    }
    const [hasSelection, start, end] = widget.getSelectionBounds();
    return hasSelection ? widget.getChars(start, end) : "";
};

const deleteSelection = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        widget.getBuffer().deleteSelection(false, true);
        return;
    }
    widget.deleteSelection();
};

const setEditableText = (widget: EditableTarget, text: string): void => {
    if (widget instanceof Gtk.TextView) {
        widget.getBuffer().setText(text, text.length);
        return;
    }
    widget.setText(text);
};

const applyInitialSelection = (widget: EditableTarget, options: TypeOptions): void => {
    if (options.initialSelectionStart === undefined) return;
    const start = options.initialSelectionStart;
    const end = options.initialSelectionEnd ?? start;
    if (widget instanceof Gtk.TextView) {
        const buffer = widget.getBuffer();
        buffer.selectRange(buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));
        if (end !== start) deleteSelection(widget);
        return;
    }
    widget.selectRegion(start, end);
    if (end !== start) widget.deleteSelection();
    widget.setPosition(start);
};

const writeClipboardText = (widget: Gtk.Widget, text: string): void => {
    const value = GObject.buildValue(GObject.TYPE_STRING, (v) => v.setString(text));
    widget.getClipboard().set(value);
};

export const resetClipboard = (): void => {
    Gdk.Display.getDefault()?.getClipboard().setContent(null);
};

/**
 * Focuses the editable widget (unless `options.skipClick`) and inserts `text` at the cursor, optionally after selecting an initial range to replace.
 * @param widget Editable widget to type into.
 * @param text Text to insert.
 * @param options Focus and initial selection options.
 */
export const type = (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> =>
    wrapEvent(widget, () => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot type into element: ${EDITABLE_REQUIRED}`);
        }

        if (!options?.skipClick) {
            widget.grabFocus();
        }

        applyInitialSelection(widget, options ?? {});
        insertEditableText(widget, text);
    });

/**
 * Clears all text from the editable widget.
 * @param widget Editable widget to clear.
 */
export const clear = (widget: Gtk.Widget): Promise<void> =>
    wrapEvent(widget, () => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot clear element: ${EDITABLE_REQUIRED}`);
        }

        setEditableText(widget, "");
    });

/**
 * Copies the editable widget's current selection to the clipboard.
 * @param widget Editable widget to copy from.
 */
export const copy = (widget: Gtk.Widget): Promise<void> =>
    wrapEvent(widget, () => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot copy: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readSelection(widget));
    });

/**
 * Copies the editable widget's current selection to the clipboard and deletes it.
 * @param widget Editable widget to cut from.
 */
export const cut = (widget: Gtk.Widget): Promise<void> =>
    wrapEvent(widget, () => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot cut: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readSelection(widget));
        deleteSelection(widget);
    });

/**
 * Inserts text at the editable widget's cursor, using the given `text` or the current clipboard contents when omitted.
 * @param widget Editable widget to paste into.
 * @param text Text to paste; falls back to the clipboard when not provided.
 */
export const paste = async (widget: Gtk.Widget, text?: string): Promise<void> => {
    if (!isEditable(widget)) {
        throw new Error(`Cannot paste: ${EDITABLE_REQUIRED}`);
    }

    const content = text ?? (await widget.getClipboard().readTextAsync(null)) ?? "";
    await wrapEvent(widget, () => {
        insertEditableText(widget, content);
    });
};
