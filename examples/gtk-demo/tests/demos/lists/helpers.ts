import * as Gtk from "@gtkx/ffi/gtk";

/**
 * Recursively collect every descendant of `root` that is an instance of `ctor`.
 */
export const findAll = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const out: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) out.push(node);
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return out;
};

/**
 * Return the first descendant of `root` that is an instance of `ctor`, or null.
 */
export const findFirst = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T | null =>
    findAll(root, ctor)[0] ?? null;

/**
 * Walk up from `root` and return the enclosing `GtkApplicationWindow`, or null.
 */
export const findApplicationWindow = (root: Gtk.Widget): Gtk.ApplicationWindow | null => {
    let current: Gtk.Widget | null = root;
    while (current) {
        if (current instanceof Gtk.ApplicationWindow) return current;
        current = current.getParent();
    }
    return null;
};

/**
 * Walk up from `start.getParent()` and return the nearest ancestor of `ctor`.
 */
export const ancestorOfType = <T extends Gtk.Widget>(
    start: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T | null => {
    let current: Gtk.Widget | null = start.getParent();
    while (current) {
        if (current instanceof ctor) return current;
        current = current.getParent();
    }
    return null;
};
