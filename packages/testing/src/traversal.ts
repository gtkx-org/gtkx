import * as Gtk from "@gtkx/ffi/gtk";

/**
 * Root element for scoping queries.
 *
 * When a `Gtk.Application` is provided, queries search across all toplevel
 * windows. When a `Gtk.Widget` is provided, queries are scoped to that
 * widget's subtree.
 */
export type Container = Gtk.Application | Gtk.Widget;

export const isApplication = (container: Container): container is Gtk.Application =>
    "getWindows" in container && typeof container.getWindows === "function";

const traverseWidgetTree = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;

    let child = root.getFirstChild();
    while (child) {
        yield* traverseWidgetTree(child);
        child = child.getNextSibling();
    }
};

const traverseWindows = function* (): Generator<Gtk.Widget> {
    const windows = Gtk.Window.listToplevels();
    for (const window of windows) {
        yield* traverseWidgetTree(window);
    }
};

export const traverse = function* (container: Container): Generator<Gtk.Widget> {
    if (isApplication(container)) {
        yield* traverseWindows();
    } else {
        yield* traverseWidgetTree(container);
    }
};

export const findAll = (container: Container, predicate: (node: Gtk.Widget) => boolean): Gtk.Widget[] => {
    const results: Gtk.Widget[] = [];
    for (const node of traverse(container)) {
        if (node.getAccessibleRole?.() === Gtk.AccessibleRole.LABEL) continue;
        if (predicate(node)) {
            results.push(node);
        }
    }
    return results;
};
