import * as Gtk from "@gtkx/ffi/gtk";

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

/** Options for {@link getChildTexts}. */
export interface ChildTextOptions {
    /**
     * When `true` (the default), each direct child's subtree is searched for
     * its first `Gtk.Label`. When `false`, only direct children that are
     * themselves a `Gtk.Label` contribute text.
     */
    recursive?: boolean;
}

/**
 * Extracts label text from the direct children of a widget.
 *
 * Used to read back what a list/grid/column view or container actually
 * rendered, without depending on a specific cell-widget structure.
 */
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
