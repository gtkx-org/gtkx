import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "./dispatch.js";
import { EDITABLE_ROLES, getEditableDelegate, isEditable } from "./editable.js";
import { formatRoleList } from "./role-helpers.js";

export type TypeOptions = {
    skipClick?: boolean | undefined;
    initialSelectionStart?: number | undefined;
    initialSelectionEnd?: number | undefined;
};

const EDITABLE_REQUIRED = `expected editable widget (${formatRoleList(EDITABLE_ROLES)})`;

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

export const resetClipboard = (): void => {
    Gdk.Display.getDefault()?.getClipboard().setContent(null);
};

export const type = (widget: Gtk.Widget, text: string, options?: TypeOptions): Promise<void> =>
    runInAct(() => {
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

export const clear = (widget: Gtk.Widget): Promise<void> =>
    runInAct(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot clear element: ${EDITABLE_REQUIRED}`);
        }

        widget.setText("");
    });

export const copy = (widget: Gtk.Widget): Promise<void> =>
    runInAct(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot copy: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readEditableSelection(widget));
    });

export const cut = (widget: Gtk.Widget): Promise<void> =>
    runInAct(() => {
        if (!isEditable(widget)) {
            throw new Error(`Cannot cut: ${EDITABLE_REQUIRED}`);
        }

        writeClipboardText(widget, readEditableSelection(widget));
        widget.deleteSelection();
    });

export const paste = async (widget: Gtk.Widget, text?: string): Promise<void> => {
    if (!isEditable(widget)) {
        throw new Error(`Cannot paste: ${EDITABLE_REQUIRED}`);
    }

    const content = text ?? (await widget.getClipboard().readTextAsync(null)) ?? "";
    await runInAct(() => {
        insertEditableText(widget, content);
    });
};
