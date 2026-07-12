import * as Gtk from "@gtkx/gi/gtk";

export const TOPLEVELS: unique symbol = Symbol("gtkx.toplevels");

type QueryContainer = Gtk.Widget | Gtk.EventController | Gtk.LayoutManager | Gtk.ListItem | Gtk.ListHeader;

/**
 * A scope that queries and traversal can run against: a widget, an event
 * controller, a layout manager, a list item or header, an application, or the
 * sentinel representing all current toplevel windows.
 */
export type Container = QueryContainer | Gtk.Application | typeof TOPLEVELS;

const isApplication = (container: Container): container is Gtk.Application => container instanceof Gtk.Application;

const traverseWidgetTree = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;

    let child = root.getFirstChild();
    while (child) {
        yield* traverseWidgetTree(child);
        child = child.getNextSibling();
    }
};

export const descendants = function* (widget: Gtk.Widget): Generator<Gtk.Widget> {
    const tree = traverseWidgetTree(widget);
    tree.next();
    yield* tree;
};

const resolveRoot = (container: QueryContainer): Gtk.Widget | null => {
    if (container instanceof Gtk.Widget) return container;
    if (container instanceof Gtk.EventController) return container.getWidget();
    if (container instanceof Gtk.LayoutManager) return container.getWidget();
    if (container instanceof Gtk.ListItem || container instanceof Gtk.ListHeader) return container.getChild();
    return null;
};

export const roots = function* (container: Container): Generator<Gtk.Widget> {
    if (container === TOPLEVELS || isApplication(container)) {
        yield* Gtk.Window.listToplevels();
        return;
    }
    const root = resolveRoot(container);
    if (root) yield root;
};

export const traverse = function* (container: Container): Generator<Gtk.Widget> {
    for (const root of roots(container)) {
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
