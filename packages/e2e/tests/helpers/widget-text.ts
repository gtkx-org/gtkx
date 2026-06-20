import * as Gtk from "@gtkx/gi/gtk";

const firstLabelWithin = (widget: Gtk.Widget): string | null => {
    if (widget instanceof Gtk.Label) return widget.getLabel();
    let child = widget.getFirstChild();
    while (child) {
        const found = firstLabelWithin(child);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

export interface ChildTextOptions {
    recursive?: boolean;
}

export const getChildTexts = (container: Gtk.Widget, options: ChildTextOptions = {}): string[] => {
    const recursive = options.recursive ?? true;
    const texts: string[] = [];
    let child = container.getFirstChild();
    while (child) {
        const text = recursive ? firstLabelWithin(child) : child instanceof Gtk.Label ? child.getLabel() : null;
        if (text) texts.push(text);
        child = child.getNextSibling();
    }
    return texts;
};
