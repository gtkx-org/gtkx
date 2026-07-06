import type { ContainerProp } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { typeChainIncludes } from "../utils/gtype.js";
import { callUsesRef, nullSetterCurrentHolder, resolveContainerProp, runCall } from "./element-props.js";
import { type ElementMapping, type Node, registeredStateOf, stateOf } from "./state.js";
import { childWidget } from "./wrapper-content.js";

const containerPropFor = (container: GObject.Object, child: Gtk.Widget): ContainerProp | null =>
    resolveContainerProp(container.__type__, child.__type__, undefined);

const scopeFor = (child: Gtk.Widget) => ({ child, props: registeredStateOf(child)?.props ?? {} });

export function attachChild(child: Gtk.Widget, container: GObject.Object): void {
    const cp = containerPropFor(container, child);
    if (cp?.append !== undefined) {
        runCall(container, cp.append, [child], scopeFor(child));
        return;
    }
    if (container instanceof Gtk.Widget) child.setParent(container);
}

export function detachChild(child: Gtk.Widget, container: GObject.Object): void {
    const cp = containerPropFor(container, child);
    if (cp?.remove !== undefined) {
        const holder = nullSetterCurrentHolder(container, cp.remove);
        if (holder !== undefined) {
            if (holder === child) runCall(container, cp.remove, [child], scopeFor(child));
            return;
        }
        if (container instanceof Gtk.Widget && child.getParent() !== container) return;
        runCall(container, cp.remove, [child], scopeFor(child));
        return;
    }
    if (child.getParent() === container) child.unparent();
}

export function unparentWidget(widget: Gtk.Widget): void {
    const currentParent = widget.getParent();
    if (currentParent === null) return;
    detachChild(widget, currentParent);
}

export function getFocusWidget(widget: Gtk.Widget): Gtk.Widget | null {
    const root = widget.getRoot();
    return root?.getFocus() ?? null;
}

export function isDescendantOf(widget: Gtk.Widget, ancestor: Gtk.Widget): boolean {
    let current: Gtk.Widget | null = widget;
    while (current) {
        if (current === ancestor) return true;
        current = current.getParent();
    }
    return false;
}

const isAutowrapChild = (cp: ContainerProp | null, widget: Gtk.Widget): boolean =>
    cp?.autowrap !== undefined && !typeChainIncludes(widget.__type__, cp.autowrap);

const detachAutowrapped = (widget: Gtk.Widget): void => {
    const wrapper = widget.getParent();
    if (wrapper === null) return;
    detachChild(widget, wrapper);
    const wrapperParent = wrapper.getParent();
    if (wrapperParent !== null) detachChild(wrapper, wrapperParent);
};

function* gtkChildren(container: Gtk.Widget): IterableIterator<Gtk.Widget> {
    let child = container.getFirstChild();
    while (child) {
        yield child;
        child = child.getNextSibling();
    }
}

const unwrapGtkChild = (child: Gtk.Widget): Gtk.Widget | null => {
    if ("getChild" in child && typeof child.getChild === "function") {
        const inner: unknown = child.getChild();
        return inner instanceof Gtk.Widget ? inner : null;
    }
    return child;
};

const findWrappedPosition = (container: Gtk.Widget, anchor: Gtk.Widget, wrapper: string): number | null => {
    const anchorIsWrapper = typeChainIncludes(anchor.__type__, wrapper);
    let position = 0;
    for (const current of gtkChildren(container)) {
        const compare = anchorIsWrapper ? current : unwrapGtkChild(current);
        if (compare && compare === anchor) return position;
        position++;
    }
    return null;
};

const findInsertPosition = (container: Gtk.Widget, anchor: Gtk.Widget): number => {
    let position = 0;
    for (const current of gtkChildren(container)) {
        if (current === anchor) return position;
        position++;
    }
    return position;
};

const findPrevSibling = (container: Gtk.Widget, anchor: Gtk.Widget): Gtk.Widget | undefined => {
    for (const child of gtkChildren(container)) {
        if (child === anchor) return child.getPrevSibling() ?? undefined;
    }
    return undefined;
};

const insertAtIndex = (
    container: Gtk.Widget,
    widget: Gtk.Widget,
    anchor: Gtk.Widget,
    cp: ContainerProp & { insert: NonNullable<ContainerProp["insert"]> },
): void => {
    if (cp.autowrap !== undefined) {
        if (widget.getParent() !== null) {
            if (isAutowrapChild(cp, widget)) detachAutowrapped(widget);
            else unparentWidget(widget);
        }
        const position = findWrappedPosition(container, anchor, cp.autowrap);
        if (position === null) attachChild(widget, container);
        else runCall(container, cp.insert, [widget, position], { child: widget, index: position });
        return;
    }
    unparentWidget(widget);
    const position = findInsertPosition(container, anchor);
    runCall(container, cp.insert, [widget, position], { child: widget, index: position });
};

const insertBySibling = (container: Gtk.Widget, widget: Gtk.Widget, anchor: Gtk.Widget, cp: ContainerProp): void => {
    const previous = findPrevSibling(container, anchor);
    const scope = { child: widget, sibling: previous ?? null };
    if (widget.getParent() === container && cp.reorder !== undefined) {
        runCall(container, cp.reorder, [widget, previous], scope);
        return;
    }
    unparentWidget(widget);
    if (cp.insert !== undefined) runCall(container, cp.insert, [widget, previous], scope);
    else attachChild(widget, container);
};

const reinsertAll = (parent: Node, container: GObject.Object): void => {
    const widgets: Gtk.Widget[] = [];
    for (const child of stateOf(parent).children) {
        const widget = childWidget(child);
        if (widget) widgets.push(widget);
    }
    for (const widget of widgets) detachChild(widget, container);
    for (const widget of widgets) attachChild(widget, container);
};

const insertWidgetBefore = (parent: Node, container: GObject.Object, widget: Gtk.Widget, anchor: Gtk.Widget): void => {
    const cp = containerPropFor(container, widget);
    if (cp?.insert !== undefined && callUsesRef(cp.insert, "index") && container instanceof Gtk.Widget) {
        insertAtIndex(container, widget, anchor, { ...cp, insert: cp.insert });
        return;
    }
    if (
        container instanceof Gtk.Widget &&
        (cp?.reorder !== undefined || (cp?.insert !== undefined && callUsesRef(cp.insert, "sibling")))
    ) {
        insertBySibling(container, widget, anchor, cp);
        return;
    }
    reinsertAll(parent, container);
};

const appendWidget = (container: GObject.Object, widget: Gtk.Widget, fresh: boolean): void => {
    if (!fresh && widget.getParent() !== null) {
        const cp = containerPropFor(container, widget);
        if (isAutowrapChild(cp, widget)) detachAutowrapped(widget);
        else unparentWidget(widget);
    }
    attachChild(widget, container);
};

const removeWidget = (container: GObject.Object, widget: Gtk.Widget): void => {
    const cp = containerPropFor(container, widget);
    if (!isAutowrapChild(cp, widget)) {
        detachChild(widget, container);
        return;
    }
    const wrapper = widget.getParent();
    if (wrapper !== null && wrapper !== container) {
        detachChild(widget, wrapper);
        detachChild(wrapper, container);
    }
};

export const containerMapping: ElementMapping = {
    matches: (child, parent) => childWidget(child) !== null && parent instanceof GObject.Object,
    attach: (child, parent, anchor, fresh) => {
        const widget = childWidget(child);
        if (!(parent instanceof GObject.Object) || !widget) return;
        if (!(parent instanceof Gtk.Widget) && containerPropFor(parent, widget) === null) return;
        if (anchor instanceof Gtk.Widget) insertWidgetBefore(parent, parent, widget, anchor);
        else appendWidget(parent, widget, fresh === true);
    },
    detach: (child, parent) => {
        const widget = childWidget(child);
        if (parent instanceof GObject.Object && widget) removeWidget(parent, widget);
    },
};
