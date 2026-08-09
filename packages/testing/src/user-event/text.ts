import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { EDITABLE_ROLES, type EditableTarget, getEditableDelegate, isEditable } from "../editable.js";
import { formatRoleList } from "../role-helpers.js";
import { getWidgetSelection } from "../widget-accessible-properties.js";
import { callBooleanGetter } from "../widget-getters.js";
import { wrapEvent } from "./event-wrapper.js";

/** Options for `userEvent.type`. */
type TypeOptions = {
    /** Focus the widget before typing; defaults to true. */
    shouldFocus?: boolean | undefined;
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

const readSelection = (widget: EditableTarget): string => getWidgetSelection(widget) ?? "";

const deleteSelection = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        widget.getBuffer().deleteSelection(false, true);

        return;
    }

    widget.deleteSelection();
};

const deleteAllText = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        const buffer = widget.getBuffer();
        buffer.deleteInteractive(buffer.getStartIter(), buffer.getEndIter(), widget.getEditable());

        return;
    }

    widget.deleteText(0, -1);
};

const applyTextViewSelection = (widget: Gtk.TextView, start: number, end: number): void => {
    const buffer = widget.getBuffer();
    buffer.selectRange(buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));

    if (end !== start) {
        deleteSelection(widget);
    }
};

const applyEditableSelection = (widget: Gtk.Editable, start: number, end: number): void => {
    widget.selectRegion(start, end);

    if (end !== start) {
        widget.deleteSelection();
    }

    widget.setPosition(start);
};

const applyInitialSelection = (widget: EditableTarget, options: TypeOptions): void => {
    if (options.initialSelectionStart === undefined) {
        return;
    }

    const start = options.initialSelectionStart;
    const end = options.initialSelectionEnd ?? start;

    if (widget instanceof Gtk.TextView) {
        applyTextViewSelection(widget, start, end);

        return;
    }

    applyEditableSelection(widget, start, end);
};

const writeClipboardText = (widget: Gtk.Widget, text: string): void => {
    const value = GObject.buildValue(GObject.TYPE_STRING, (v) => {
        v.setString(text);
    });

    widget.getClipboard().set(value);
};

const resetClipboard = (): void => {
    Gdk.Display.getDefault()?.getClipboard().setContent(null);
};

const runEditableEvent = (
    widget: Gtk.Widget,
    failure: string,
    action: (editable: EditableTarget) => void,
): Promise<void> =>
    wrapEvent(widget, () => {
        if (!isEditable(widget)) {
            throw new Error(`${failure}: ${EDITABLE_REQUIRED}`);
        }

        action(widget);
    });

/**
 * Focuses the widget unless `shouldFocus` is false, applies any initial selection, and inserts the text
 * at the cursor.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView.
 */
const type = (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> =>
    runEditableEvent(widget, "Cannot type into element", (editable) => {
        if (options?.shouldFocus ?? true) {
            editable.grabFocus();
        }

        applyInitialSelection(editable, options ?? {});
        insertEditableText(editable, text);
    });

const isWidgetEditable = (widget: Gtk.Widget): boolean => callBooleanGetter(widget, "getEditable") ?? true;

const hasNonEditableChar = (iter: Gtk.TextIter, isDefaultEditable: boolean): boolean => {
    while (!iter.isEnd()) {
        if (!iter.editable(isDefaultEditable)) {
            return true;
        }

        if (!iter.forwardChar()) {
            return false;
        }
    }

    return false;
};

const hasProtectedText = (widget: EditableTarget): boolean =>
    widget instanceof Gtk.TextView && hasNonEditableChar(widget.getBuffer().getStartIter(), widget.getEditable());

/**
 * Focuses an editable widget and deletes its whole text through the widget's own editing API, so the
 * deletion emits the signals an edit made by hand emits.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView, when it refuses edits, or
 * when part of its text survives the deletion because a tag protects it.
 */
const clear = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot clear element", (editable) => {
        if (!isWidgetEditable(editable)) {
            throw new Error("Cannot clear element: the widget is not editable");
        }

        editable.grabFocus();
        deleteAllText(editable);

        if (hasProtectedText(editable)) {
            throw new Error("Cannot clear element: the widget refuses to delete part of its text");
        }
    });

/**
 * Writes an editable widget's selected text to its clipboard, or the empty string when nothing is selected.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView.
 */
const copy = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot copy", (editable) => {
        writeClipboardText(editable, readSelection(editable));
    });

/**
 * Writes an editable widget's selected text to its clipboard, then deletes that selection.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView.
 */
const cut = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot cut", (editable) => {
        writeClipboardText(editable, readSelection(editable));
        deleteSelection(editable);
    });

/**
 * Inserts the given text at an editable widget's cursor, reading the clipboard instead when no text
 * is given.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView.
 */
const paste = async (widget: Gtk.Widget, text?: string): Promise<void> => {
    if (!isEditable(widget)) {
        throw new Error(`Cannot paste: ${EDITABLE_REQUIRED}`);
    }

    const content = text ?? (await widget.getClipboard().readTextAsync(null)) ?? "";

    await wrapEvent(widget, () => {
        insertEditableText(widget, content);
    });
};

export { resetClipboard, type, clear, copy, cut, paste, type TypeOptions };
