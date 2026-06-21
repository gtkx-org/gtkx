import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "./dispatch.js";
import { EDITABLE_ROLES, type EditableTarget, getEditableDelegate, isEditable } from "./editable.js";
import { formatRoleList } from "./role-helpers.js";

export type TypeOptions = {
    skipClick?: boolean | undefined;
    initialSelectionStart?: number | undefined;
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

/**
 * Clears the process clipboard contents.
 */
export const resetClipboard = (): void => {
    Gdk.Display.getDefault()?.getClipboard().setContent(null);
};

/**
 * Types `text` into an editable widget inside a single `act()` wrap.
 *
 * @param widget - The target widget; must be editable.
 * @param text - The text to insert at the cursor.
 * @param options - Optional click-skip and initial-selection controls.
 * @returns A promise that resolves once the insertion is committed.
 */
export const type = (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> =>
    runInAct(() => {
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
 * Clears an editable widget's text inside a single `act()` wrap.
 *
 * @param widget - The target widget; must be editable.
 * @returns A promise that resolves once the text is cleared.
 */
export const clear = (widget: Gtk.Widget): Promise<void> =>
    runInAct(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot clear element: ${EDITABLE_REQUIRED}`);
        }

        setEditableText(widget, "");
    });

/**
 * Copies an editable widget's current selection to the clipboard inside a single `act()` wrap.
 *
 * @param widget - The target widget; must be editable.
 * @returns A promise that resolves once the clipboard is set.
 */
export const copy = (widget: Gtk.Widget): Promise<void> =>
    runInAct(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot copy: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readSelection(widget));
    });

/**
 * Cuts an editable widget's current selection to the clipboard inside a single `act()` wrap.
 *
 * @param widget - The target widget; must be editable.
 * @returns A promise that resolves once the selection is cut.
 */
export const cut = (widget: Gtk.Widget): Promise<void> =>
    runInAct(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot cut: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readSelection(widget));
        deleteSelection(widget);
    });

/**
 * Pastes text into an editable widget inside a single `act()` wrap, reading the clipboard when
 * `text` is omitted.
 *
 * @param widget - The target widget; must be editable.
 * @param text - Optional explicit text to paste instead of clipboard contents.
 * @returns A promise that resolves once the paste is committed.
 */
export const paste = async (widget: Gtk.Widget, text?: string): Promise<void> => {
    if (!isEditable(widget)) {
        throw new Error(`Cannot paste: ${EDITABLE_REQUIRED}`);
    }

    const content = text ?? (await widget.getClipboard().readTextAsync(null)) ?? "";
    await runInAct(() => {
        insertEditableText(widget, content);
    });
};
