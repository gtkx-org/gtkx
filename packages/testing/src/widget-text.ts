import * as Gtk from "@gtkx/ffi/gtk";
import { getAccessibleMetadata } from "@gtkx/react";

const getLabelText = (widget: Gtk.Widget): string | null => {
    const asLabel = widget as Gtk.Label;
    const asInscription = widget as Gtk.Inscription;
    return asLabel.getLabel?.() ?? asInscription.getText?.() ?? null;
};

const DEFAULT_TEXT_GETTERS = ["getLabel", "getText", "getTitle"] as const;

const getDefaultText = (widget: Gtk.Widget): string | null => {
    for (const getter of DEFAULT_TEXT_GETTERS) {
        const fn: unknown = Reflect.get(widget, getter);
        if (typeof fn !== "function") continue;
        const value = (fn as () => string).call(widget);
        if (value) return value;
    }
    return null;
};

const collectLabels = (widget: Gtk.Widget, recursive: boolean): string[] => {
    const labels: string[] = [];
    let child = widget.getFirstChild();

    while (child) {
        if (child.getAccessibleRole() === Gtk.AccessibleRole.LABEL) {
            const labelText = getLabelText(child);
            if (labelText) labels.push(labelText);
        }
        if (recursive) labels.push(...collectLabels(child, true));
        child = child.getNextSibling();
    }

    return labels;
};

/**
 * Returns the text content of a widget, analogous to RTL's getNodeText.
 *
 * Collects direct child GtkLabel text (treated as text nodes) and joins
 * them into a single string. Widget properties like getLabel(), getTitle(),
 * getText() are NOT included — those are attributes, not text content.
 *
 * @param widget - The widget to extract text from
 * @returns The joined text content or null if none found
 */
export const getWidgetText = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();
    if (role === undefined) return null;

    const childLabels = collectLabels(widget, false);
    return childLabels.length > 0 ? childLabels.join(" ") : null;
};

/**
 * Returns the widget's own text from properties (getLabel, getText, getTitle).
 *
 * Used for display/debugging purposes (e.g., prettyWidget). This is
 * analogous to HTML attributes like aria-label, not text content.
 *
 * @param widget - The widget to extract property text from
 * @returns The property text or null if none found
 */
export const getWidgetPropertyText = (widget: Gtk.Widget): string | null => {
    return getDefaultText(widget);
};

/**
 * Computes the accessible name of a widget for role-based queries.
 *
 * Uses the widget's own text properties first, then recursively collects
 * all descendant label text. This mirrors how ARIA accessible name
 * computation works in the DOM.
 *
 * @param widget - The widget to compute the accessible name for
 * @returns The accessible name or null if none found
 */
export const getWidgetAccessibleName = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();
    if (role === undefined) return null;

    if (role === Gtk.AccessibleRole.TAB_PANEL) {
        const parent = widget.getParent();
        if (parent) {
            const stack = parent as Gtk.Stack;
            const page = stack.getPage?.(widget);
            if (page) {
                return page.getTitle() ?? null;
            }
        }
        return null;
    }

    const accessibleLabel = getAccessibleMetadata<string>(widget, "accessibleLabel");
    if (accessibleLabel) return accessibleLabel;

    const ownText = getDefaultText(widget);
    if (ownText) return ownText;

    const childLabels = collectLabels(widget, true);
    return childLabels.length > 0 ? childLabels.join(" ") : null;
};

/**
 * Gets the widget name (gtk_widget_get_name).
 *
 * @param widget - The widget to get the name from
 * @returns The widget name or null if not set
 */
export const getWidgetName = (widget: Gtk.Widget): string | null => {
    return widget.getName();
};

/**
 * Gets the checked state from toggle-like widgets.
 *
 * @param widget - The widget to get the checked state from
 * @returns The checked state or null if not applicable
 */
export const getWidgetCheckedState = (widget: Gtk.Widget): boolean | null => {
    const role = widget.getAccessibleRole();

    switch (role) {
        case Gtk.AccessibleRole.CHECKBOX:
        case Gtk.AccessibleRole.RADIO:
            return (widget as Gtk.CheckButton).getActive();
        case Gtk.AccessibleRole.TOGGLE_BUTTON:
            return (widget as Gtk.ToggleButton).getActive();
        case Gtk.AccessibleRole.SWITCH:
            return (widget as Gtk.Switch).getActive();
        default:
            return null;
    }
};

/**
 * Gets the pressed state from toggle button widgets.
 *
 * @param widget - The widget to get the pressed state from
 * @returns The pressed state or null if not applicable
 */
export const getWidgetPressedState = (widget: Gtk.Widget): boolean | null => {
    const role = widget.getAccessibleRole();

    if (role === Gtk.AccessibleRole.TOGGLE_BUTTON) {
        return (widget as Gtk.ToggleButton).getActive();
    }

    return null;
};

/**
 * Gets the expanded state from expander widgets.
 *
 * @param widget - The widget to get the expanded state from
 * @returns The expanded state or null if not applicable
 */
export const getWidgetExpandedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.Expander) {
        return widget.getExpanded();
    }

    if (widget instanceof Gtk.TreeExpander) {
        return widget.getListRow()?.getExpanded() ?? null;
    }

    return null;
};

/**
 * Gets the selected state from selectable widgets.
 *
 * @param widget - The widget to get the selected state from
 * @returns The selected state or null if not applicable
 */
export const getWidgetSelectedState = (widget: Gtk.Widget): boolean | null => {
    const role = widget.getAccessibleRole();

    if (role === Gtk.AccessibleRole.ROW) {
        return (widget as Gtk.ListBoxRow).isSelected();
    }

    if (role === Gtk.AccessibleRole.LIST_ITEM && widget instanceof Gtk.ListBoxRow) {
        return widget.isSelected();
    }

    return null;
};

/**
 * Gets the accessible heading level from widgets that declare one via the
 * `accessibleLevel` JSX prop (mirrors GTK's `AccessibleProperty.LEVEL`).
 *
 * @param widget - The widget to get the level from
 * @returns The numeric level or null if none is set
 */
export const getWidgetLevel = (widget: Gtk.Widget): number | null => {
    const level = getAccessibleMetadata<number>(widget, "accessibleLevel");
    return typeof level === "number" ? level : null;
};
