import * as Gtk from "@gtkx/gi/gtk";
import { getEditableDelegate } from "./editable.js";

type TextEntry = Gtk.Text | Gtk.Entry;

/** Stands in for text a widget hides, such as the contents of a password entry. */
const REDACTED_TEXT = "[redacted]";

const HIDDEN_INPUT_PURPOSES: Set<Gtk.InputPurpose> = new Set<Gtk.InputPurpose>([
    Gtk.InputPurpose.PASSWORD,
    Gtk.InputPurpose.PIN,
]);

const isTextEntry = (widget: Gtk.Widget): widget is TextEntry =>
    widget instanceof Gtk.Text || widget instanceof Gtk.Entry;

const isEntryTextHidden = (entry: TextEntry): boolean =>
    !entry.getVisibility() || HIDDEN_INPUT_PURPOSES.has(entry.getInputPurpose());

const isTextHidden = (widget: Gtk.Widget): boolean => {
    let current: Gtk.Widget | null = widget;

    while (current) {
        if (isTextEntry(current) && isEntryTextHidden(current)) {
            return true;
        }

        current = getEditableDelegate(current);
    }

    return false;
};

const redactText = (widget: Gtk.Widget, text: string | null): string | null => {
    if (!text || !isTextHidden(widget)) {
        return text;
    }

    return REDACTED_TEXT;
};

export { isTextHidden, redactText, REDACTED_TEXT };
