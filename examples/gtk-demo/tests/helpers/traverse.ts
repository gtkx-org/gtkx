import * as Gtk from "@gtkx/ffi/gtk";

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
 * Returns every widget in `root`'s subtree that is an instance of `ctor`,
 * in document order (pre-order). Use this when a test needs to count or
 * iterate widgets of a given type — `@gtkx/testing` queries cannot
 * discriminate by widget class.
 */
export const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    visitDescendants(root, (widget) => {
        if (widget instanceof ctor) matches.push(widget);
    });
    return matches;
};

/**
 * Walks the ancestor chain from `widget`'s parent upward and returns the first
 * ancestor that is an instance of `ctor`, or `null` if no such ancestor exists.
 * Use when navigating from a found descendant up to its container.
 */
export const ancestorOfType = <T extends Gtk.Widget>(
    widget: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T | null => {
    let current: Gtk.Widget | null = widget.getParent();
    while (current) {
        if (current instanceof ctor) return current;
        current = current.getParent();
    }
    return null;
};

/**
 * Walks `widget` and its ancestors and returns the enclosing
 * `Gtk.ApplicationWindow`, or `null` if none exists. Use when a test needs
 * access to the host window (e.g. its titlebar) given a descendant widget.
 */
export const findApplicationWindow = (widget: Gtk.Widget): Gtk.ApplicationWindow | null => {
    let current: Gtk.Widget | null = widget;
    while (current) {
        if (current instanceof Gtk.ApplicationWindow) return current;
        current = current.getParent();
    }
    return null;
};

/**
 * Collects every event controller of `ctor` attached to `widget` via
 * `observeControllers()`. Required because GTK exposes controllers through
 * a model, not as widget children.
 */
export const collectControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T[] => {
    const observer = widget.observeControllers();
    const out: T[] = [];
    const count = observer.getNItems();
    for (let i = 0; i < count; i++) {
        const controller = observer.getItem(i);
        if (controller instanceof ctor) out.push(controller);
    }
    return out;
};
