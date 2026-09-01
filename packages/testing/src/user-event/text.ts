import * as Gdk from "@gtkx/gi/gdk";
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

type InsertKind = "typing" | "pasting";

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
const SINGLE_CHARACTER_LENGTH = 1;
const TEXT_END_POSITION = -1;

const isWidgetEditable = (widget: Gtk.Widget): boolean => callBooleanGetter(widget, "getEditable") ?? true;
const readSelection = (widget: EditableTarget): string => getWidgetSelection(widget) ?? "";
const hasSelectedText = (widget: Gtk.Editable): boolean => widget.getSelectionBounds()[0];

const getDelegateText = (widget: Gtk.Editable): Gtk.Text | null => {
    const delegate = getEditableDelegate(widget) ?? widget;

    return delegate instanceof Gtk.Text ? delegate : null;
};

const getSelectionLength = (buffer: Gtk.TextBuffer): number => {
    const [isSelected, start, end] = buffer.getSelectionBounds();

    return isSelected ? end.getOffset() - start.getOffset() : 0;
};

const deleteSelection = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        widget.getBuffer().deleteSelection(false, true);

        return;
    }

    widget.deleteSelection();
};

const focusPlainEditable = (widget: Gtk.Editable): void => {
    const [isSelected, start, end] = widget.getSelectionBounds();
    widget.grabFocus();

    if (isSelected) {
        widget.selectRegion(start, end);

        return;
    }

    widget.setPosition(TEXT_END_POSITION);
};

const focusEditable = (widget: EditableTarget): void => {
    if (widget instanceof Gtk.TextView) {
        widget.grabFocus();

        return;
    }

    const target = getDelegateText(widget);

    if (target === null) {
        focusPlainEditable(widget);

        return;
    }

    target.grabFocusWithoutSelecting();

    if (!hasSelectedText(widget)) {
        widget.setPosition(TEXT_END_POSITION);
    }
};

const insertTextViewText = (widget: Gtk.TextView, text: string, kind: InsertKind): void => {
    const buffer = widget.getBuffer();
    const length = getSelectionLength(buffer);
    buffer.beginUserAction();

    if (length > 0) {
        widget.emit("delete-from-cursor", Gtk.DeleteType.CHARS, SELECTION_DELETE_COUNT);

        if (kind === "typing" && length > SINGLE_CHARACTER_LENGTH) {
            buffer.endUserAction();
            buffer.beginUserAction();
        }
    }

    widget.emit("insert-at-cursor", text);
    buffer.endUserAction();
};

const insertDelegateText = (target: Gtk.Text, text: string): void => {
    if (hasSelectedText(target)) {
        target.emit("delete-from-cursor", Gtk.DeleteType.CHARS, SELECTION_DELETE_COUNT);
    }

    target.emit("insert-at-cursor", text);
};

const insertPlainText = (widget: Gtk.Editable, text: string): void => {
    if (!isWidgetEditable(widget)) {
        return;
    }

    if (hasSelectedText(widget)) {
        widget.deleteSelection();
    }

    const position = widget.getPosition();
    const newPosition = widget.insertText(text, text.length, position);
    widget.setPosition(newPosition);
};

const insertEditableText = (widget: EditableTarget, text: string, kind: InsertKind): void => {
    if (widget instanceof Gtk.TextView) {
        insertTextViewText(widget, text, kind);

        return;
    }

    const target = getDelegateText(widget);

    if (target === null) {
        insertPlainText(widget, text);

        return;
    }

    insertDelegateText(target, text);
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
    widget.getClipboard().set(text);
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

/** Types into an editable widget. */
const type = (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> =>
    runEditableEvent(widget, "Cannot type into element", (editable) => {
        if (options?.shouldFocus ?? true) {
            focusEditable(editable);
        }

        applyInitialSelection(editable, options ?? {});
        insertEditableText(editable, text, "typing");
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

/** Deletes all text from an editable widget. */
const clear = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot clear element", clearEditable);

/** Copies the current selection. */
const copy = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot copy", (editable) => {
        writeClipboardText(editable, readSelection(editable));
    });

/** Cuts the current selection. */
const cut = (widget: Gtk.Widget): Promise<void> =>
    runEditableEvent(widget, "Cannot cut", (editable) => {
        writeClipboardText(editable, readSelection(editable));
        deleteSelection(editable);
    });

/** Pastes text or clipboard contents. */
const paste = async (widget: Gtk.Widget, text?: string): Promise<void> => {
    if (!isEditable(widget)) {
        throw new Error(`Cannot paste: ${EDITABLE_REQUIRED}`);
    }

    const content = text ?? (await widget.getClipboard().readTextAsync(null)) ?? "";

    await wrapEvent(widget, () => {
        insertEditableText(widget, content, "pasting");
    });
};

export { resetClipboard, type, clear, copy, cut, paste, type TypeOptions };
