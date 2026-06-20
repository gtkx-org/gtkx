import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

/**
 * Scope sentinel spanning every presented top-level window. The default
 * `baseElement` and `screen` root: queries resolve through
 * `Gtk.Window.listToplevels()`, so they reach popovers, menus, and dialogs that
 * present as their own top-levels rather than as children of the rendered window.
 */
export const TOPLEVELS: unique symbol = Symbol("gtkx.toplevels");

export type Container = GObject.Object | typeof TOPLEVELS;

const isApplication = (container: Container): container is Gtk.Application =>
    container instanceof Gtk.Application;

const traverseWidgetTree = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;

    let child = root.getFirstChild();
    while (child) {
        yield* traverseWidgetTree(child);
        child = child.getNextSibling();
    }
};

/**
 * Yields every descendant of a widget in depth-first order, excluding the widget
 * itself. The single GTK child-iteration primitive: walks each child's subtree
 * through {@link https://docs.gtk.org/gtk4/method.Widget.get_first_child.html | `getFirstChild`}/{@link https://docs.gtk.org/gtk4/method.Widget.get_next_sibling.html | `getNextSibling`}.
 *
 * @param widget - The widget whose descendants to enumerate.
 * @returns A generator over each descendant widget.
 */
export const descendants = function* (widget: Gtk.Widget): Generator<Gtk.Widget> {
    let child = widget.getFirstChild();
    while (child) {
        yield* traverseWidgetTree(child);
        child = child.getNextSibling();
    }
};

const resolveRoot = (container: GObject.Object): Gtk.Widget | null => {
    if (container instanceof Gtk.Widget) return container;
    if (container instanceof Gtk.EventController) return container.getWidget();
    if (container instanceof Gtk.LayoutManager) return container.getWidget();
    if (container instanceof Gtk.ListItem || container instanceof Gtk.ListHeader) return container.getChild();
    return null;
};

/**
 * Yields the root widget(s) a container resolves to: every presented top-level
 * window for the {@link TOPLEVELS} sentinel or an application, otherwise the
 * single widget the container maps to (a widget, an event controller's or
 * layout manager's widget, a list item's or header's child). The single
 * authority for container-scope resolution, shared by the query traversal and
 * the tree printer.
 *
 * @param container - The query scope to resolve.
 * @returns A generator over the container's root widgets.
 */
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
