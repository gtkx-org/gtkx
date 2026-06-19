import * as Gtk from "@gtkx/gi/gtk";
import { getAccessibleMetadata } from "@gtkx/react";
import { isEditable } from "./editable.js";

const callStringGetter = (widget: Gtk.Widget, method: string): string | null => {
    const fn: unknown = Reflect.get(widget, method);
    if (typeof fn !== "function") return null;
    const value = (fn as () => string | null).call(widget);
    return value ?? null;
};

const readAccessibleString = (widget: Gtk.Widget, key: string): string | null => {
    const value = getAccessibleMetadata<string>(widget, key);
    return typeof value === "string" ? value : null;
};

const readAccessibleNumber = (widget: Gtk.Widget, key: string): number | null => {
    const value = getAccessibleMetadata<number>(widget, key);
    return typeof value === "number" ? value : null;
};

const readAccessibleBoolean = (widget: Gtk.Widget, key: string): boolean | null => {
    const value = getAccessibleMetadata<boolean>(widget, key);
    return typeof value === "boolean" ? value : null;
};

const getLabelText = (widget: Gtk.Widget): string | null => {
    const asLabel = widget as Gtk.Label;
    const asInscription = widget as Gtk.Inscription;
    return asLabel.getLabel?.() ?? asInscription.getText?.() ?? null;
};

const DEFAULT_TEXT_GETTERS = ["getLabel", "getText", "getTitle"] as const;

const getDefaultText = (widget: Gtk.Widget): string | null => {
    for (const getter of DEFAULT_TEXT_GETTERS) {
        const value = callStringGetter(widget, getter);
        if (value) return value;
    }
    return null;
};

const collectLabels = (widget: Gtk.Widget): string[] => {
    const labels: string[] = [];
    let child = widget.getFirstChild();

    while (child) {
        if (child.getAccessibleRole() === Gtk.AccessibleRole.LABEL) {
            const labelText = getLabelText(child);
            if (labelText) labels.push(labelText);
        }
        labels.push(...collectLabels(child));
        child = child.getNextSibling();
    }

    return labels;
};

/**
 * Returns the text content of a widget, analogous to RTL's getNodeText.
 *
 * Only label-role widgets (`GtkLabel`, `GtkInscription`) carry text content —
 * mirroring React Native, where text exists only inside `<Text>` — so a text
 * query resolves to the label rendering the text. Every other widget,
 * including buttons and containers, has no text content; find interactive
 * widgets by role and accessible name instead.
 *
 * @param widget - The widget to extract text from
 * @returns The label's text, or null for widgets that carry no text content
 */
export const getWidgetText = (widget: Gtk.Widget): string | null => {
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) return null;
    return getLabelText(widget);
};

/**
 * Returns the widget's own text from properties (getLabel, getText, getTitle).
 *
 * Used for display/debugging purposes (e.g., prettyWidget). This is
 * analogous to HTML attributes like accessible-label, not text content.
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
 * all descendant label text. This mirrors how ACCESSIBLE accessible name
 * computation works in the DOM.
 *
 * @param widget - The widget to compute the accessible name for
 * @returns The accessible name or null if none found
 */
export const getWidgetAccessibleName = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();

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

    const childLabels = collectLabels(widget);
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
 * Gets the placeholder text of an entry-like widget (`GtkEntry`,
 * `GtkSearchEntry`, `GtkPasswordEntry`, a standalone `GtkText`), analogous to
 * the HTML `placeholder` attribute. Scoped to editable-role widgets so the
 * internal `GtkText` delegate of a composite entry is not matched twice.
 *
 * @param widget - The widget to read the placeholder text from
 * @returns The placeholder text, or null for widgets without one
 */
export const getWidgetPlaceholderText = (widget: Gtk.Widget): string | null => {
    if (!isEditable(widget)) {
        return null;
    }

    return callStringGetter(widget, "getPlaceholderText");
};

/**
 * Gets the current value displayed by an editable widget, analogous to the
 * `value` of an HTML `input`/`textarea`. Editable widgets (`GtkEntry`,
 * `GtkText`, `GtkSearchEntry`, `GtkSpinButton`) report their editable text.
 *
 * @param widget - The widget to read the display value from
 * @returns The displayed value, or null for widgets that carry none
 */
export const getWidgetDisplayValue = (widget: Gtk.Widget): string | null => {
    if (isEditable(widget)) {
        return widget.getText();
    }

    return null;
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
    if (widget instanceof Gtk.ListBoxRow) {
        return widget.isSelected();
    }

    if (widget.getAccessibleRole() === Gtk.AccessibleRole.ROW) {
        return (widget.getStateFlags() & Gtk.StateFlags.SELECTED) !== 0;
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
    return readAccessibleNumber(widget, "accessibleLevel");
};

/**
 * Gets the busy state declared via the `accessibleBusy` JSX prop (mirrors GTK's
 * `AccessibleState.BUSY`).
 *
 * @param widget - The widget to read the busy state from
 * @returns The busy state, or null when none is declared
 */
export const getWidgetBusyState = (widget: Gtk.Widget): boolean | null => {
    return readAccessibleBoolean(widget, "accessibleBusy");
};

/**
 * Gets the accessible description declared via the `accessibleDescription` JSX
 * prop (mirrors GTK's `AccessibleProperty.DESCRIPTION`).
 *
 * @param widget - The widget to read the description from
 * @returns The description, or null when none is declared
 */
export const getWidgetDescription = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, "accessibleDescription");
};

/**
 * The accessible value of a widget, declared via the `accessibleValueNow`,
 * `accessibleValueMin`, `accessibleValueMax`, and `accessibleValueText` JSX
 * props (mirrors GTK's `AccessibleProperty.VALUE_*`). Each field is null when
 * the corresponding prop is not declared.
 */
export type WidgetValue = {
    /** The current value (`AccessibleProperty.VALUE_NOW`) */
    now: number | null;
    /** The minimum value (`AccessibleProperty.VALUE_MIN`) */
    min: number | null;
    /** The maximum value (`AccessibleProperty.VALUE_MAX`) */
    max: number | null;
    /** The human-readable value text (`AccessibleProperty.VALUE_TEXT`) */
    text: string | null;
};

/**
 * Gets the accessible value of a widget from its declared `accessibleValue*`
 * JSX props.
 *
 * @param widget - The widget to read the value from
 * @returns The declared value fields, each null when not declared
 */
export const getWidgetValue = (widget: Gtk.Widget): WidgetValue => ({
    now: readAccessibleNumber(widget, "accessibleValueNow"),
    min: readAccessibleNumber(widget, "accessibleValueMin"),
    max: readAccessibleNumber(widget, "accessibleValueMax"),
    text: readAccessibleString(widget, "accessibleValueText"),
});

/**
 * Gets a widget's own accessible label, declared via the `accessibleLabel` JSX
 * prop (the analog of the HTML `accessible-label` attribute).
 *
 * @param widget - The widget to read the label from
 * @returns The label, or null when none is declared
 */
export const getWidgetOwnLabel = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, "accessibleLabel");
};

/**
 * Gets the combined text of the widgets a widget is labeled by, declared via
 * the `accessibleLabelledBy` JSX prop (the analog of HTML `accessible-labelledby`).
 *
 * @param widget - The widget to resolve the labeling text for
 * @returns The joined accessible names of the labeling widgets, or null
 */
export const getWidgetLabelledByText = (widget: Gtk.Widget): string | null => {
    const targets = getAccessibleMetadata<Gtk.Widget[]>(widget, "accessibleLabelledBy");
    if (!Array.isArray(targets) || targets.length === 0) return null;

    const texts: string[] = [];
    for (const target of targets) {
        const text = getWidgetAccessibleName(target);
        if (text !== null) texts.push(text);
    }

    return texts.length > 0 ? texts.join(" ") : null;
};

/**
 * Reports whether a widget is hidden from the accessibility tree — either it or
 * an ancestor is not visible, or declares the `accessibleHidden` state. The GTK
 * analog of `@testing-library/dom`'s `isInaccessible`.
 *
 * @param widget - The widget to test
 * @returns `true` when the widget is hidden from accessibility
 */
export const isHiddenFromAccessibility = (widget: Gtk.Widget): boolean => {
    let current: Gtk.Widget | null = widget;
    while (current) {
        if (!current.getVisible()) return true;
        if (readAccessibleBoolean(current, "accessibleHidden") === true) return true;
        current = current.getParent();
    }
    return false;
};
