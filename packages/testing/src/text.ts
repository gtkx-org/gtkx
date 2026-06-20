import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act } from "./act.js";
import { getEditableDelegate, isEditable } from "./editable.js";

/**
 * Options for {@link userEvent.type}.
 */
export type TypeOptions = {
    /** Skip focusing the widget before typing (default: false) */
    skipClick?: boolean;
    /** Selection anchor to place before typing */
    initialSelectionStart?: number;
    /** Selection end to place before typing (defaults to `initialSelectionStart`) */
    initialSelectionEnd?: number;
};

const EDITABLE_REQUIRED = "expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)";

const insertEditableText = (widget: Gtk.Editable, text: string): void => {
    const target = getEditableDelegate(widget) ?? widget;
    if (target instanceof Gtk.Text || target instanceof Gtk.TextView) {
        target.emit("insert-at-cursor", text);
        return;
    }

    const position = widget.getPosition();
    const newPosition = widget.insertText(text, text.length, position);
    widget.setPosition(newPosition);
};

const readEditableSelection = (widget: Gtk.Editable): string => {
    const [hasSelection, start, end] = widget.getSelectionBounds();
    return hasSelection ? widget.getChars(start, end) : "";
};

const writeClipboardText = (widget: Gtk.Widget, text: string): void => {
    const value = GObject.buildValue(GObject.TYPE_STRING, (v) => v.setString(text));
    widget.getClipboard().set(value);
};

/**
 * Clears the display clipboard that {@link userEvent.copy}/{@link userEvent.cut}/
 * {@link userEvent.paste} operate on. Called by `cleanup` so clipboard contents
 * do not leak between tests sharing a display.
 */
export const resetClipboard = (): void => {
    Gdk.Display.getDefault()?.getClipboard().setContent(null);
};

/**
 * Types text into an editable widget.
 *
 * Appends text to the current content. Works with Entry, SearchEntry,
 * and SpinButton widgets.
 *
 * @param widget - The editable widget
 * @param text - Text to type
 * @param options - Selection and focus behavior before typing
 */
export const type = async (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> => {
    await act(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot type into element: ${EDITABLE_REQUIRED}`);
        }

        if (!options?.skipClick) {
            widget.grabFocus();
        }

        if (options?.initialSelectionStart !== undefined) {
            const start = options.initialSelectionStart;
            const end = options.initialSelectionEnd ?? start;
            widget.selectRegion(start, end);
            if (end !== start) {
                widget.deleteSelection();
            }
            widget.setPosition(start);
        }

        insertEditableText(widget, text);
    });
};

/**
 * Clears an editable widget's content.
 *
 * Sets the text to empty string.
 *
 * @param widget - The editable widget to clear.
 */
export const clear = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot clear element: ${EDITABLE_REQUIRED}`);
        }

        widget.setText("");
    });
};

/**
 * Copies an editable widget's current selection to an in-memory clipboard
 * that {@link paste} reads from.
 *
 * @param widget - The editable widget to copy from.
 */
export const copy = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot copy: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readEditableSelection(widget));
    });
};

/**
 * Cuts an editable widget's current selection: copies it to the in-memory
 * clipboard, then deletes it.
 *
 * @param widget - The editable widget to cut from.
 */
export const cut = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot cut: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readEditableSelection(widget));
        widget.deleteSelection();
    });
};

/**
 * Pastes text into an editable widget at the cursor. Uses the supplied
 * `text`, or the in-memory clipboard written by {@link copy}/{@link cut}.
 *
 * @param widget - The editable widget to paste into.
 * @param text - Text to paste; defaults to the in-memory clipboard contents.
 */
export const paste = async (widget: Gtk.Widget, text?: string): Promise<void> => {
    if (!isEditable(widget)) {
        throw new Error(`Cannot paste: ${EDITABLE_REQUIRED}`);
    }

    const content = text ?? (await widget.getClipboard().readTextAsync(null)) ?? "";
    await act(() => {
        insertEditableText(widget, content);
    });
};
