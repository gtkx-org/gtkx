import { getNativeInterface } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";

const ROLES_WITH_INTERNAL_LABELS = new Set([
    Gtk.AccessibleRole.BUTTON,
    Gtk.AccessibleRole.TOGGLE_BUTTON,
    Gtk.AccessibleRole.CHECKBOX,
    Gtk.AccessibleRole.RADIO,
    Gtk.AccessibleRole.MENU_ITEM,
    Gtk.AccessibleRole.MENU_ITEM_CHECKBOX,
    Gtk.AccessibleRole.MENU_ITEM_RADIO,
    Gtk.AccessibleRole.TAB,
    Gtk.AccessibleRole.LINK,
]);

const isInternalLabel = (widget: Gtk.Widget): boolean => {
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) return false;

    const parent = widget.getParent();
    if (!parent) return false;

    if (parent.getAccessibleRole === undefined) return false;
    const parentRole = parent.getAccessibleRole();
    if (!parentRole) return false;

    return ROLES_WITH_INTERNAL_LABELS.has(parentRole);
};

const getLabelText = (widget: Gtk.Widget): string | null => {
    const asLabel = widget as Gtk.Label;
    const asInscription = widget as Gtk.Inscription;
    return asLabel.getLabel?.() ?? asInscription.getText?.() ?? null;
};

const collectChildLabels = (widget: Gtk.Widget): string[] => {
    const labels: string[] = [];
    let child = widget.getFirstChild();

    while (child) {
        if (child.getAccessibleRole() === Gtk.AccessibleRole.LABEL) {
            const labelText = getLabelText(child);
            if (labelText) labels.push(labelText);
        }

        labels.push(...collectChildLabels(child));
        child = child.getNextSibling();
    }

    return labels;
};

/**
 * Extracts the accessible text content from a widget based on its role.
 *
 * @param widget - The widget to extract text from
 * @returns The accessible text or null if none found
 */
export const getWidgetText = (widget: Gtk.Widget): string | null => {
    if (isInternalLabel(widget)) return null;

    const role = widget.getAccessibleRole();
    if (role === undefined) return null;

    switch (role) {
        case Gtk.AccessibleRole.BUTTON:
        case Gtk.AccessibleRole.LINK:
        case Gtk.AccessibleRole.TAB: {
            const directLabel =
                (widget as Gtk.Button).getLabel?.() ??
                (widget as Gtk.MenuButton).getLabel?.() ??
                (widget as Gtk.Expander).getLabel?.();
            if (directLabel) return directLabel;

            const childLabels = collectChildLabels(widget);
            return childLabels.length > 0 ? childLabels.join(" ") : null;
        }
        case Gtk.AccessibleRole.TOGGLE_BUTTON:
            return (widget as Gtk.ToggleButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.CHECKBOX:
        case Gtk.AccessibleRole.RADIO:
            return (widget as Gtk.CheckButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.LABEL:
            return getLabelText(widget);
        case Gtk.AccessibleRole.TEXT_BOX:
        case Gtk.AccessibleRole.SEARCH_BOX:
        case Gtk.AccessibleRole.SPIN_BUTTON:
            return getNativeInterface(widget, Gtk.Editable)?.getText() ?? null;
        case Gtk.AccessibleRole.GROUP:
            return (widget as Gtk.Frame).getLabel?.() ?? null;
        case Gtk.AccessibleRole.WINDOW:
        case Gtk.AccessibleRole.DIALOG:
        case Gtk.AccessibleRole.ALERT_DIALOG:
            return (widget as Gtk.Window).getTitle() ?? null;
        case Gtk.AccessibleRole.TAB_PANEL: {
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
        default:
            return null;
    }
};

/**
 * Gets the test ID from a widget (uses the widget's name property).
 *
 * @param widget - The widget to get the test ID from
 * @returns The test ID or null if not set
 */
export const getWidgetTestId = (widget: Gtk.Widget): string | null => {
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
 * Gets the expanded state from expander widgets.
 *
 * @param widget - The widget to get the expanded state from
 * @returns The expanded state or null if not applicable
 */
export const getWidgetExpandedState = (widget: Gtk.Widget): boolean | null => {
    const role = widget.getAccessibleRole();

    if (role === Gtk.AccessibleRole.BUTTON) {
        const parent = widget.getParent();
        if (!parent) return null;
        return (parent as Gtk.Expander).getExpanded?.() ?? null;
    }

    return null;
};
