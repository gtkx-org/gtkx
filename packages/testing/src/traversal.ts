import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, getInstanceType, typeIsA } from "@gtkx/runtime";

/**
 * A scope that resolves to a single root widget: the widget itself, the widget a controller or
 * layout manager is attached to, or a list item's or header's child.
 */
type QueryContainer = Gtk.Accessible | Gtk.EventController | Gtk.LayoutManager | Gtk.ListItem | Gtk.ListHeader;
/**
 * A scope that queries and traversal can run against: a widget, an event
 * controller, a layout manager, a list item or header, an application, or the
 * sentinel representing all current toplevel windows.
 */
type Container = QueryContainer | Gtk.Application | typeof TOPLEVELS;
type WidgetClass<T extends object> = abstract new (...args: never[]) => T;
type ChildContainer = Pick<Gtk.Widget, "getFirstChild">;

/** Container sentinel that widens a query to every toplevel window currently open. */
const TOPLEVELS: unique symbol = Symbol("gtkx.toplevels");
const nativeWidgetTypes: Map<bigint, boolean> = new Map();

const isApplication = (container: Container): container is Gtk.Application => container instanceof Gtk.Application;
const isAnyWidget = (): boolean => true;
const isOnScreen = (widget: Gtk.Widget): boolean => widget.getMapped();

const isNativeWidget = (widget: Gtk.Widget): boolean => {
    const type = getInstanceType(widget);
    const cached = nativeWidgetTypes.get(type);

    if (cached !== undefined) {
        return cached;
    }

    const isNative = typeIsA(type, getClassType(Gtk.Native));
    nativeWidgetTypes.set(type, isNative);

    return isNative;
};

const traverseWidgetTree = function* (
    root: Gtk.Widget,
    isIncluded: (widget: Gtk.Widget) => boolean,
): Generator<Gtk.Widget> {
    if (isIncluded(root)) {
        yield root;
    }

    let child = root.getFirstChild();

    while (child) {
        yield* traverseWidgetTree(child, isIncluded);
        child = child.getNextSibling();
    }
};

const children = function* (widget: ChildContainer): Generator<Gtk.Widget> {
    let child = widget.getFirstChild();

    while (child) {
        yield child;
        child = child.getNextSibling();
    }
};

const descendants = function* (widget: Gtk.Widget): Generator<Gtk.Widget> {
    const tree = traverseWidgetTree(widget, isAnyWidget);
    tree.next();
    yield* tree;
};

const ancestors = function* (widget: Gtk.Widget): Generator<Gtk.Widget> {
    let parent = widget.getParent();

    while (parent) {
        yield parent;
        parent = parent.getParent();
    }
};

const ancestorFor = <T extends object>(widget: Gtk.Widget, type: WidgetClass<T>): T | null => {
    for (const ancestor of ancestors(widget)) {
        if (ancestor instanceof type) {
            return ancestor;
        }
    }

    return null;
};

const mappedWidgets = function* (widget: Gtk.Widget, isParentMapped: boolean): Generator<Gtk.Widget> {
    const isMapped = (isParentMapped || isNativeWidget(widget)) && isOnScreen(widget);

    if (isMapped) {
        yield widget;
    }

    for (const child of children(widget)) {
        yield* mappedWidgets(child, isMapped);
    }
};

const relationCandidates = (widget: Gtk.Widget): Iterable<Gtk.Accessible>[] => {
    const root = widget.getRoot();
    const tree: Iterable<Gtk.Accessible> = root instanceof Gtk.Widget ? traverseWidgetTree(root, isAnyWidget) : [];

    return [widget.listMnemonicLabels(), descendants(widget), tree];
};

const resolveRoot = (container: QueryContainer): Gtk.Widget | null => {
    if (container instanceof Gtk.Widget) {
        return container;
    }

    if (container instanceof Gtk.EventController) {
        return container.getWidget();
    }

    if (container instanceof Gtk.LayoutManager) {
        return container.getWidget();
    }

    if (container instanceof Gtk.ListItem || container instanceof Gtk.ListHeader) {
        return container.getChild();
    }

    throw new TypeError("Query container must resolve to a Gtk.Widget");
};

const roots = function* (container: Container): Generator<Gtk.Widget> {
    if (container === TOPLEVELS || isApplication(container)) {
        yield* Gtk.Window.listToplevels();

        return;
    }

    const root = resolveRoot(container);

    if (root) {
        yield root;
    }
};

const traverse = function* (container: Container): Generator<Gtk.Widget> {
    for (const root of roots(container)) {
        yield* mappedWidgets(root, true);
    }
};

const findAll = (container: Container, isMatch: (node: Gtk.Widget) => boolean): Gtk.Widget[] => {
    const results: Gtk.Widget[] = [];

    for (const node of traverse(container)) {
        if (isMatch(node)) {
            results.push(node);
        }
    }

    return results;
};

export {
    TOPLEVELS,
    ancestorFor,
    ancestors,
    children,
    descendants,
    findAll,
    isOnScreen,
    relationCandidates,
    roots,
    traverse,
    type ChildContainer,
    type Container,
};
