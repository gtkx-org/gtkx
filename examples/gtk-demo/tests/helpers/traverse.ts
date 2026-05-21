import type * as Gtk from "@gtkx/ffi/gtk";

/**
 * Visits `root` and every descendant widget in pre-order, following sibling
 * chains so that widgets are reported in document order. Non-widget nodes
 * encountered during traversal are skipped via a `getFirstChild` runtime
 * check.
 */
const visitDescendants = (root: Gtk.Widget, visit: (widget: Gtk.Widget) => void): void => {
    if (typeof root.getFirstChild !== "function") return;
    visit(root);
    let child = root.getFirstChild();
    while (child) {
        visitDescendants(child, visit);
        child = child.getNextSibling();
    }
};

/**
 * Returns the first widget in `root`'s subtree that is an instance of `ctor`,
 * or `null` if none match.
 */
export const findFirstOfType = <T extends Gtk.Widget>(
    root: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T | null => {
    let found: T | null = null;
    visitDescendants(root, (widget) => {
        if (!found && widget instanceof ctor) found = widget;
    });
    return found;
};

/**
 * Returns every widget in `root`'s subtree that is an instance of `ctor`,
 * in document order.
 */
export const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    visitDescendants(root, (widget) => {
        if (widget instanceof ctor) matches.push(widget);
    });
    return matches;
};
