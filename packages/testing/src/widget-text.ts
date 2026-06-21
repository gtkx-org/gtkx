import * as Gtk from "@gtkx/gi/gtk";
import { getAccessibleMetadata } from "@gtkx/react";
import { EDITABLE_ROLES, isEditable, readEditableText } from "./editable.js";
import { descendants } from "./traversal.js";

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
    if (widget instanceof Gtk.Label) return widget.getLabel() ?? null;
    if (widget instanceof Gtk.Inscription) return widget.getText() ?? null;
    return null;
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
    for (const descendant of descendants(widget)) {
        if (descendant.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) continue;
        const labelText = getLabelText(descendant);
        if (labelText) labels.push(labelText);
    }
    return labels;
};

export const getWidgetText = (widget: Gtk.Widget): string | null => {
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) return null;
    return getLabelText(widget);
};

export const getWidgetPropertyText = (widget: Gtk.Widget): string | null => {
    return getDefaultText(widget);
};

export const getWidgetAccessibleName = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();

    if (role === Gtk.AccessibleRole.TAB_PANEL) {
        const parent = widget.getParent();
        if (parent instanceof Gtk.Stack) {
            const page = parent.getPage(widget);
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

export const getWidgetName = (widget: Gtk.Widget): string | null => {
    return widget.getName();
};

export const getWidgetPlaceholderText = (widget: Gtk.Widget): string | null => {
    if (!EDITABLE_ROLES.has(widget.getAccessibleRole()) || !(widget instanceof Gtk.Editable)) {
        return null;
    }

    return callStringGetter(widget, "getPlaceholderText");
};

export const getWidgetDisplayValue = (widget: Gtk.Widget): string | null => {
    if (EDITABLE_ROLES.has(widget.getAccessibleRole()) && isEditable(widget)) {
        return readEditableText(widget);
    }

    return null;
};

export const getWidgetCheckedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.CheckButton) return widget.getActive();
    if (widget instanceof Gtk.Switch) return widget.getActive();
    return null;
};

export const getWidgetPressedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.ToggleButton) return widget.getActive();
    return null;
};

export const getWidgetExpandedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.Expander) {
        return widget.getExpanded();
    }

    if (widget instanceof Gtk.TreeExpander) {
        return widget.getListRow()?.getExpanded() ?? null;
    }

    return null;
};

export const getWidgetSelectedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.ListBoxRow) {
        return widget.isSelected();
    }

    if (widget.getAccessibleRole() === Gtk.AccessibleRole.ROW) {
        return (widget.getStateFlags() & Gtk.StateFlags.SELECTED) !== 0;
    }

    return null;
};

export const getWidgetLevel = (widget: Gtk.Widget): number | null => {
    return readAccessibleNumber(widget, "accessibleLevel");
};

export const getWidgetBusyState = (widget: Gtk.Widget): boolean | null => {
    return readAccessibleBoolean(widget, "accessibleBusy");
};

export const getWidgetDescription = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, "accessibleDescription");
};

export type WidgetValue = {
    now: number | null;
    min: number | null;
    max: number | null;
    text: string | null;
};

export const getWidgetValue = (widget: Gtk.Widget): WidgetValue => ({
    now: readAccessibleNumber(widget, "accessibleValueNow"),
    min: readAccessibleNumber(widget, "accessibleValueMin"),
    max: readAccessibleNumber(widget, "accessibleValueMax"),
    text: readAccessibleString(widget, "accessibleValueText"),
});

export const getWidgetOwnLabel = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, "accessibleLabel");
};

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

export const isHiddenFromAccessibility = (widget: Gtk.Widget): boolean => {
    let current: Gtk.Widget | null = widget;
    while (current) {
        if (!current.getVisible()) return true;
        if (readAccessibleBoolean(current, "accessibleHidden") === true) return true;
        current = current.getParent();
    }
    return false;
};
