import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { EDITABLE_ROLES, type EditableTarget, getEditableDelegate, isEditable, readEditableText } from "../editable.js";
import { formatRoleList } from "../role-helpers.js";
import { getWidgetSelection } from "../widget-accessible-properties.js";
import { callBooleanGetter } from "../widget-getters.js";
import { wrapEvent } from "./event-wrapper.js";

type SignalWatchTarget = {
    on(signal: string, handler: (...args: unknown[]) => unknown, isAfter?: boolean): unknown;
    off(signal: string, handler: (...args: unknown[]) => unknown): unknown;
};

type CursorTarget = Gtk.Text | Gtk.TextView;

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
const CLEAR_REFUSED = "Cannot clear element: the widget refuses to delete part of its text";
const SELECTION_DELETE_COUNT = 1;
const TEXT_END_POSITION = -1;

const isWidgetEditable = (widget: Gtk.Widget): boolean => callBooleanGetter(widget, "getEditable") ?? true;
const readSelection = (widget: EditableTarget): string => getWidgetSelection(widget) ?? "";

const cursorTargetFor = (widget: EditableTarget): CursorTarget | null => {
    if (widget instanceof Gtk.TextView) {
        return widget;
    }

    const delegate = getEditableDelegate(widget) ?? widget;

    return delegate instanceof Gtk.Text ? delegate : null;
};

const hasSelectedText = (widget: EditableTarget): boolean => {
    if (widget instanceof Gtk.TextView) {
        return widget.getBuffer().getHasSelection();
    }

    const [isSelected] = widget.getSelectionBounds();

    return isSelected;
};

const deleteSelection = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        widget.getBuffer().deleteSelection(false, true);

        return;
    }

    widget.deleteSelection();
};

const deleteSelectedText = (widget: EditableTarget): void => {
    const target = cursorTargetFor(widget);

    if (target === null) {
        deleteSelection(widget);

        return;
    }

    target.emit("delete-from-cursor", Gtk.DeleteType.CHARS, SELECTION_DELETE_COUNT);
};

const focusEditable = (widget: EditableTarget): void => {
    const target = cursorTargetFor(widget);

    if (!(target instanceof Gtk.Text)) {
        widget.grabFocus();

        return;
    }

    target.grabFocusWithoutSelecting();

    if (!hasSelectedText(target)) {
        target.setPosition(TEXT_END_POSITION);
    }
};

const insertEditableText = (widget: EditableTarget, text: string): void => {
    if (hasSelectedText(widget)) {
        deleteSelectedText(widget);
    }

    if (widget instanceof Gtk.TextView) {
        widget.emit("insert-at-cursor", text);

        return;
    }

    const target = cursorTargetFor(widget);

    if (target !== null) {
        target.emit("insert-at-cursor", text);

        return;
    }

    const position = widget.getPosition();
    const newPosition = widget.insertText(text, text.length, position);
    widget.setPosition(newPosition);
};

const deleteAllText = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        const buffer = widget.getBuffer();
        buffer.deleteInteractive(buffer.getStartIter(), buffer.getEndIter(), widget.getEditable());

        return;
    }

    widget.deleteText(0, -1);
};

const applyInitialSelection = (widget: EditableTarget, options: TypeOptions): void => {
    if (options.initialSelectionStart === undefined) {
        return;
    }

    const start = options.initialSelectionStart;
    const end = options.initialSelectionEnd ?? start;

    if (widget instanceof Gtk.TextView) {
        const buffer = widget.getBuffer();
        buffer.selectRange(buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));

        return;
    }

    widget.selectRegion(start, end);
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
 * Focuses the widget unless `shouldFocus` is false, applies any initial selection, and inserts the
 * text at the cursor, replacing the text the widget has selected the way typing over a selection does
 * in GTK4. Focusing leaves an entry's text alone and puts its caret at the end, so successive calls
 * append, and the replaced text stays on the widget's undo stack.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView.
 */
const type = (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> =>
    runEditableEvent(widget, "Cannot type into element", (editable) => {
        if (options?.shouldFocus ?? true) {
            focusEditable(editable);
        }

        applyInitialSelection(editable, options ?? {});
        insertEditableText(editable, text);
    });

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

const requireClearableText = (editable: EditableTarget): void => {
    if (!isWidgetEditable(editable)) {
        throw new Error("Cannot clear element: the widget is not editable");
    }

    if (hasProtectedText(editable)) {
        throw new Error(CLEAR_REFUSED);
    }
};

const deletionSignalFor = (widget: EditableTarget): [SignalWatchTarget, string] =>
    widget instanceof Gtk.TextView ? [widget.getBuffer(), "delete-range"] : [widget, "delete-text"];

const isDeletionApplied = (emitter: SignalWatchTarget, signal: string, apply: () => void): boolean => {
    let isApplied = false;

    const watch = (): void => {
        isApplied = true;
    };

    emitter.on(signal, watch, true);

    try {
        apply();
    } finally {
        emitter.off(signal, watch);
    }

    return isApplied;
};

const didDeleteAllText = (widget: EditableTarget): boolean => {
    const [emitter, signal] = deletionSignalFor(widget);

    return isDeletionApplied(emitter, signal, () => {
        deleteAllText(widget);
    });
};

const clearEditable = (editable: EditableTarget): void => {
    requireClearableText(editable);
    focusEditable(editable);

    if (readEditableText(editable) === "") {
        return;
    }

    if (!didDeleteAllText(editable)) {
        throw new Error(CLEAR_REFUSED);
    }
};

/**
 * Focuses an editable widget and deletes its whole text through the widget's own editing API, so the
 * deletion emits the signals an edit made by hand emits. Text a tag protects is detected before the
 * deletion runs, leaving such a widget untouched. A widget that writes a new value back in response
 * to the deletion, as an input mask does, is cleared successfully and keeps whatever it wrote.
 *
 * @throws When the widget is neither a Gtk.Editable nor a Gtk.TextView, when it refuses edits, when
 * a tag protects part of its text, or when a handler blocks the deletion.
 */
const clear = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot clear element", clearEditable);

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
 * is given, and replacing the text the widget has selected the way a paste does in GTK4.
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
