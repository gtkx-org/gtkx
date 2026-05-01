import type * as Gtk from "@gtkx/ffi/gtk";
import { resolvePropMeta } from "../../metadata.js";

import { isAddable, isAppendable, isContentWidget, isRemovable, isSingleChild } from "./predicates.js";

export function detachChild(child: Gtk.Widget, container: Gtk.Widget): void {
    if (isAppendable(container) || isAddable(container)) {
        if (isRemovable(container)) {
            container.remove(child);
        }
    } else if (isContentWidget(container)) {
        container.setContent(null);
    } else if (isSingleChild(container)) {
        container.setChild(null);
    } else if (isRemovable(container)) {
        container.remove(child);
    } else {
        child.unparent();
    }
}

export function attachChild(child: Gtk.Widget, container: Gtk.Widget): void {
    if (isAppendable(container)) {
        container.append(child);
    } else if (isAddable(container)) {
        container.add(child);
    } else if (isContentWidget(container)) {
        container.setContent(child);
    } else if (isSingleChild(container)) {
        container.setChild(child);
    } else {
        child.setParent(container);
    }
}

export function isAttachedTo(child: Gtk.Widget | null, parent: Gtk.Widget | null): boolean {
    if (!child || !parent) return false;
    const childParent = child.getParent();
    return childParent !== null && childParent === parent;
}

export function unparentWidget(widget: Gtk.Widget): void {
    const currentParent = widget.getParent();
    if (currentParent === null) return;
    if (isRemovable(currentParent)) {
        currentParent.remove(widget);
    } else {
        widget.unparent();
    }
}

export function removeChildFromParent(
    parent: Gtk.Widget & { remove: (child: Gtk.Widget) => void },
    child: Gtk.Widget,
): void {
    if (child.getParent() === parent) {
        parent.remove(child);
    }
}

export function getFocusWidget(widget: Gtk.Widget): Gtk.Widget | null {
    const root = widget.getRoot();
    return root?.getFocus?.() ?? null;
}

export function isDescendantOf(widget: Gtk.Widget, ancestor: Gtk.Widget): boolean {
    let current: Gtk.Widget | null = widget;

    while (current) {
        if (current === ancestor) {
            return true;
        }

        current = current.getParent();
    }

    return false;
}

export function resolvePropertySetter(
    parentWidget: Gtk.Widget,
    propId: string,
): ((child: Gtk.Widget | null) => void) | null {
    const propName = resolvePropMeta(parentWidget, propId);

    if (!propName) {
        return null;
    }

    return (child: Gtk.Widget | null) => {
        (parentWidget as unknown as Record<string, unknown>)[propName] = child;
    };
}
