import type * as Gtk from "@gtkx/gi/gtk";

import { isAddable, isAppendable, isContentWidget, isRemovable, isSingleChild } from "./predicates.js";

export function detachChild(child: Gtk.Widget, container: Gtk.Widget): void {
    if (!isAttachedTo(child, container)) return;
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
    detachChild(widget, currentParent);
}

export function getFocusWidget(widget: Gtk.Widget): Gtk.Widget | null {
    const root = widget.getRoot();
    return root?.getFocus() ?? null;
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
