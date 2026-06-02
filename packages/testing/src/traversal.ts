import * as Gtk from "@gtkx/gi/gtk";
import type { BackingInstance } from "@gtkx/react";

export type Container = BackingInstance;

export const isApplication = (container: Container): container is Gtk.Application =>
    container instanceof Gtk.Application;

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

const resolveRoot = (container: Container): Gtk.Widget | null => {
    if (container instanceof Gtk.Widget) return container;
    if (container instanceof Gtk.EventController) return container.getWidget();
    if (container instanceof Gtk.LayoutManager) return container.getWidget();
    if (container instanceof Gtk.ListItem || container instanceof Gtk.ListHeader) return container.getChild();
    return null;
};

export const traverse = function* (container: Container): Generator<Gtk.Widget> {
    if (isApplication(container)) {
        yield* traverseWindows();
        return;
    }
    const root = resolveRoot(container);
    if (root) {
        yield* traverseWidgetTree(root);
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
