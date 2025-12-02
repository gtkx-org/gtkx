import type * as Gtk from "@gtkx/ffi/gtk";

type Container = Gtk.Application | Gtk.Widget;

const isApplication = (container: Container): container is Gtk.Application =>
    "getWindows" in container && typeof container.getWindows === "function";

const traverseWidgetTree = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;

    let child = root.getFirstChild();
    while (child) {
        yield* traverseWidgetTree(child);
        child = child.getNextSibling();
    }
};

const traverseApplication = function* (app: Gtk.Application): Generator<Gtk.Widget> {
    const windows = app.getWindows();
    for (const window of windows) {
        yield* traverseWidgetTree(window);
    }
};

const traverse = function* (container: Container): Generator<Gtk.Widget> {
    if (isApplication(container)) {
        yield* traverseApplication(container);
    } else {
        yield* traverseWidgetTree(container);
    }
};

export const findAll = (container: Container, predicate: (node: Gtk.Widget) => boolean): Gtk.Widget[] => {
    const results: Gtk.Widget[] = [];
    for (const node of traverse(container)) {
        if (predicate(node)) {
            results.push(node);
        }
    }
    return results;
};
