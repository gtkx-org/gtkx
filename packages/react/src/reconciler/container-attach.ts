import type { AttachRule } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { typeChainIncludes } from "../utils/gtype.js";
import { callUsesRef, nullSetterCurrentHolder, resolveAttachRule, runCall } from "./rule-table.js";
import { type ElementMapping, type Node, registeredStateOf, stateOf } from "./state.js";
import { childWidget, isToplevel } from "./wrapper-content.js";

const containerRuleFor = (container: GObject.Object, child: Gtk.Widget): AttachRule | null => {
    const resolved = resolveAttachRule(container.__type__, child.__type__, undefined);
    return resolved?.kind === "attach" ? resolved.rule : null;
};

const scopeFor = (child: Gtk.Widget) => ({ child, props: registeredStateOf(child)?.props ?? {} });

export function attachChild(child: Gtk.Widget, container: GObject.Object): void {
    const rule = containerRuleFor(container, child);
    if (rule?.add !== undefined) {
        runCall(container, rule.add, [child], scopeFor(child));
        return;
    }
    if (container instanceof Gtk.Widget) child.setParent(container);
}

export function detachChild(child: Gtk.Widget, container: GObject.Object): void {
    const rule = containerRuleFor(container, child);
    if (rule?.remove !== undefined) {
        const holder = nullSetterCurrentHolder(container, rule.remove);
        if (holder !== undefined) {
            if (holder === child) runCall(container, rule.remove, [child], scopeFor(child));
            return;
        }
        if (container instanceof Gtk.Widget && child.getParent() !== container) return;
        runCall(container, rule.remove, [child], scopeFor(child));
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

const isAutowrapChild = (rule: AttachRule | null, widget: Gtk.Widget): boolean =>
    rule?.autowrap !== undefined && !typeChainIncludes(widget.__type__, rule.autowrap);

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
    rule: AttachRule & { insert: NonNullable<AttachRule["insert"]> },
): void => {
    if (rule.autowrap !== undefined) {
        if (widget.getParent() !== null) {
            if (isAutowrapChild(rule, widget)) detachAutowrapped(widget);
            else unparentWidget(widget);
        }
        const position = findWrappedPosition(container, anchor, rule.autowrap);
        if (position === null) attachChild(widget, container);
        else runCall(container, rule.insert, [widget, position], { child: widget, index: position });
        return;
    }
    unparentWidget(widget);
    const position = findInsertPosition(container, anchor);
    runCall(container, rule.insert, [widget, position], { child: widget, index: position });
};

const insertBySibling = (container: Gtk.Widget, widget: Gtk.Widget, anchor: Gtk.Widget, rule: AttachRule): void => {
    const previous = findPrevSibling(container, anchor);
    const scope = { child: widget, sibling: previous ?? null };
    if (widget.getParent() === container && rule.reorder !== undefined) {
        runCall(container, rule.reorder, [widget, previous], scope);
        return;
    }
    unparentWidget(widget);
    if (rule.insert !== undefined) runCall(container, rule.insert, [widget, previous], scope);
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
    const rule = containerRuleFor(container, widget);
    if (rule?.insert !== undefined && callUsesRef(rule.insert, "index") && container instanceof Gtk.Widget) {
        insertAtIndex(container, widget, anchor, { ...rule, insert: rule.insert });
        return;
    }
    if (
        container instanceof Gtk.Widget &&
        (rule?.reorder !== undefined || (rule?.insert !== undefined && callUsesRef(rule.insert, "sibling")))
    ) {
        insertBySibling(container, widget, anchor, rule);
        return;
    }
    reinsertAll(parent, container);
};

const appendWidget = (container: GObject.Object, widget: Gtk.Widget, fresh: boolean): void => {
    if (!fresh && widget.getParent() !== null) {
        const rule = containerRuleFor(container, widget);
        if (isAutowrapChild(rule, widget)) detachAutowrapped(widget);
        else unparentWidget(widget);
    }
    attachChild(widget, container);
};

const removeWidget = (container: GObject.Object, widget: Gtk.Widget): void => {
    const rule = containerRuleFor(container, widget);
    if (!isAutowrapChild(rule, widget)) {
        detachChild(widget, container);
        return;
    }
    const wrapper = widget.getParent();
    if (wrapper !== null && wrapper !== container) {
        detachChild(widget, wrapper);
        detachChild(wrapper, container);
    }
};

export const toplevelSkipMapping: ElementMapping = {
    matches: (child) => isToplevel(child),
    attach: () => {},
    detach: () => {},
};

export const containerMapping: ElementMapping = {
    matches: (child, parent) => childWidget(child) !== null && parent instanceof GObject.Object,
    attach: (child, parent, anchor, fresh) => {
        const widget = childWidget(child);
        if (!(parent instanceof GObject.Object) || !widget) return;
        if (!(parent instanceof Gtk.Widget) && containerRuleFor(parent, widget) === null) return;
        if (anchor instanceof Gtk.Widget) insertWidgetBefore(parent, parent, widget, anchor);
        else appendWidget(parent, widget, fresh === true);
    },
    detach: (child, parent) => {
        const widget = childWidget(child);
        if (parent instanceof GObject.Object && widget) removeWidget(parent, widget);
    },
};
