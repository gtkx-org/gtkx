import * as Gtk from "@gtkx/gi/gtk";
import { type AnyNode, nodeObject, PROP_KIND, TEXT_KIND } from "./node.js";

const removedWidgets = (node: AnyNode): Gtk.Widget[] => {
    if (node.kind === TEXT_KIND) {
        return [];
    }

    if (node.kind === PROP_KIND) {
        return node.children.flatMap((child) => removedWidgets(child));
    }

    const object = nodeObject(node);

    return object instanceof Gtk.Widget ? [object] : [];
};

const holdsFocus = (widget: Gtk.Widget, focus: Gtk.Widget): boolean => focus === widget || focus.isAncestor(widget);

const grabNearestAncestor = (widget: Gtk.Widget): boolean => {
    let ancestor = widget.getParent();

    while (ancestor !== null) {
        if (ancestor.getVisible() && ancestor.grabFocus()) {
            return true;
        }

        ancestor = ancestor.getParent();
    }

    return false;
};

const focusFirstOutside = (widget: Gtk.Widget, root: Gtk.Root & Gtk.Widget): boolean =>
    grabNearestAncestor(widget) || root.childFocus(Gtk.DirectionType.TAB_FORWARD);

const moveFocusOutOf = (widget: Gtk.Widget, root: Gtk.Root & Gtk.Widget): void => {
    if (widget === root) {
        root.setFocus(null);

        return;
    }

    const canFocus = widget.getCanFocus();
    widget.setCanFocus(false);

    try {
        if (!focusFirstOutside(widget, root)) {
            root.setFocus(null);
        }
    } finally {
        widget.setCanFocus(canFocus);
    }
};

/**
 * Moves the window's focus out of a subtree that is about to be detached, where GTK would move it
 * after the removal: to the nearest visible ancestor that takes the focus, else to the window's
 * first focusable widget outside the subtree, and nowhere when the whole window goes. Detaching
 * innermost first otherwise leaves the window pointing at an unparented widget, which makes
 * containers such as `GtkPaned` warn.
 */
const releaseFocus = (node: AnyNode): void => {
    for (const widget of removedWidgets(node)) {
        const root = widget.getRoot();
        const focus = root?.getFocus() ?? null;

        if (root instanceof Gtk.Widget && focus !== null && holdsFocus(widget, focus)) {
            moveFocusOutOf(widget, root);
        }
    }
};

export { releaseFocus };
