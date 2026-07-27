import * as Gtk from "@gtkx/gi/gtk";
import { getAccessibleMetadata } from "@gtkx/react/internal";
import { EDITABLE_ROLES, isEditable, readEditableText } from "./editable.js";
import { descendants } from "./traversal.js";

type WidgetValue = {
    now: number | null;
    min: number | null;
    max: number | null;
    text: string | null;
};

type ValueTriplet = { now: number | null; min: number | null; max: number | null };

const DEFAULT_TEXT_GETTERS = ["getLabel", "getText", "getTitle"] as const;

const callStringGetter = (widget: Gtk.Widget, method: string): string | null => {
    const fn: unknown = Reflect.get(widget, method);

    if (typeof fn !== "function") {
        return null;
    }

    const value = (fn as () => string | null).call(widget);

    return value ?? null;
};

const readAccessibleString = (widget: Gtk.Widget, key: string): string | null => {
    const value = getAccessibleMetadata(widget, key);

    return typeof value === "string" ? value : null;
};

const readAccessibleNumber = (widget: Gtk.Widget, key: string): number | null => {
    const value = getAccessibleMetadata(widget, key);

    return typeof value === "number" ? value : null;
};

const readAccessibleWidgets = (widget: Gtk.Widget, key: string): Gtk.Widget[] | null => {
    const value = getAccessibleMetadata(widget, key);

    if (!Array.isArray(value)) {
        return null;
    }

    const widgets = value.filter((item): item is Gtk.Widget => item instanceof Gtk.Widget);

    return widgets.length > 0 ? widgets : null;
};

const readAccessibleBoolean = (widget: Gtk.Widget, key: string): boolean | null => {
    const value = getAccessibleMetadata(widget, key);

    return typeof value === "boolean" ? value : null;
};

const getLabelText = (widget: Gtk.Widget): string | null => {
    if (widget instanceof Gtk.Label) {
        return widget.getLabel();
    }

    if (widget instanceof Gtk.Inscription) {
        return widget.getText() ?? null;
    }

    return null;
};

/**
 * Returns a widget's own text by trying its label, text, and title getters in
 * order, or null when none produce a value.
 *
 * @param widget The widget to read text from.
 */
const getWidgetNodeText = (widget: Gtk.Widget): string | null => {
    for (const getter of DEFAULT_TEXT_GETTERS) {
        const value = callStringGetter(widget, getter);

        if (value) {
            return value;
        }
    }

    return null;
};

const stripMnemonic = (text: string): string => text.replaceAll(/_(.)/g, "$1");

const namingLabelText = (widget: Gtk.Widget): string | null => {
    const text = getLabelText(widget);

    if (text === null) {
        return null;
    }

    return widget instanceof Gtk.Label && widget.getUseUnderline() ? stripMnemonic(text) : text;
};

const isNamingLabelRole = (role: Gtk.AccessibleRole, shouldIncludePresentation: boolean): boolean =>
    role === Gtk.AccessibleRole.LABEL ||
    (shouldIncludePresentation && role === Gtk.AccessibleRole.PRESENTATION);

const collectLabels = (widget: Gtk.Widget): string[] => {
    const isIncludePresentation = widget.getAccessibleRole() === Gtk.AccessibleRole.MENU_ITEM;
    const labels: string[] = [];

    for (const descendant of descendants(widget)) {
        if (!isNamingLabelRole(descendant.getAccessibleRole(), isIncludePresentation)) {
            continue;
        }

        const labelText = namingLabelText(descendant);

        if (labelText) {
            labels.push(labelText);
        }
    }

    return labels;
};

const getWidgetLabelText = (widget: Gtk.Widget): string | null => {
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) {
        return null;
    }

    return getLabelText(widget);
};

const tabPanelTitle = (widget: Gtk.Widget): string | null => {
    const parent = widget.getParent();

    if (parent instanceof Gtk.Stack) {
        return parent.getPage(widget).getTitle() ?? null;
    }

    return null;
};

const getWidgetAccessibleName = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();

    if (role === Gtk.AccessibleRole.TAB_PANEL) {
        return tabPanelTitle(widget);
    }

    const accessibleLabel = readAccessibleString(widget, "accessibleLabel");

    if (accessibleLabel) {
        return accessibleLabel;
    }

    const ownText = getWidgetNodeText(widget);

    if (ownText) {
        return ownText;
    }

    const childLabels = collectLabels(widget);

    if (childLabels.length > 0) {
        return childLabels.join(" ");
    }

    return callStringGetter(widget, "getTooltipText");
};

const getWidgetName = (widget: Gtk.Widget): string | null => {
    return widget.getName();
};

const getWidgetPlaceholderText = (widget: Gtk.Widget): string | null => {
    if (!EDITABLE_ROLES.has(widget.getAccessibleRole()) || !(widget instanceof Gtk.Editable)) {
        return null;
    }

    return callStringGetter(widget, "getPlaceholderText");
};

const getWidgetDisplayValue = (widget: Gtk.Widget): string | null => {
    if (EDITABLE_ROLES.has(widget.getAccessibleRole()) && isEditable(widget)) {
        return readEditableText(widget);
    }

    return null;
};

const getWidgetCheckedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.CheckButton) {
        return widget.getActive();
    }

    if (widget instanceof Gtk.Switch) {
        return widget.getActive();
    }

    if (widget instanceof Gtk.ToggleButton && widget.getAccessibleRole() === Gtk.AccessibleRole.RADIO) {
        return widget.getActive();
    }

    return null;
};

const getWidgetPressedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.ToggleButton) {
        return widget.getActive();
    }

    return null;
};

const getWidgetExpandedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.Expander) {
        return widget.getExpanded();
    }

    if (widget instanceof Gtk.TreeExpander) {
        return widget.getListRow()?.getExpanded() ?? null;
    }

    return null;
};

const getWidgetSelectedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.ListBoxRow) {
        return widget.isSelected();
    }

    if (widget.getAccessibleRole() === Gtk.AccessibleRole.ROW) {
        return (widget.getStateFlags() & Gtk.StateFlags.SELECTED) !== 0;
    }

    return null;
};

const getWidgetLevel = (widget: Gtk.Widget): number | null => {
    return readAccessibleNumber(widget, "accessibleLevel");
};

const getWidgetInvalidState = (widget: Gtk.Widget): Gtk.AccessibleInvalidState | null => {
    const value = readAccessibleNumber(widget, "accessibleInvalid");

    return value ?? null;
};

const getWidgetErrorMessage = (widget: Gtk.Widget): Gtk.Widget[] | null =>
    readAccessibleWidgets(widget, "accessibleErrorMessage");

const getWidgetBusyState = (widget: Gtk.Widget): boolean | null => {
    return readAccessibleBoolean(widget, "accessibleBusy");
};

const getWidgetDescription = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, "accessibleDescription");
};

const adjustmentValue = (adjustment: Gtk.Adjustment): ValueTriplet => ({
    now: adjustment.getValue(),
    min: adjustment.getLower(),
    max: adjustment.getUpper(),
});

const adjustmentWidgetValue = (widget: Gtk.Widget): ValueTriplet | null => {
    if (widget instanceof Gtk.Range) {
        return adjustmentValue(widget.getAdjustment());
    }

    if (widget instanceof Gtk.Scrollbar) {
        return adjustmentValue(widget.getAdjustment());
    }

    if (widget instanceof Gtk.SpinButton) {
        return adjustmentValue(widget.getAdjustment());
    }

    if (widget instanceof Gtk.ScaleButton) {
        return adjustmentValue(widget.getAdjustment());
    }

    return null;
};

const getWidgetLiveValue = (widget: Gtk.Widget): ValueTriplet | null => {
    const adjustmentBased = adjustmentWidgetValue(widget);

    if (adjustmentBased) {
        return adjustmentBased;
    }

    if (widget instanceof Gtk.LevelBar) {
        return { now: widget.getValue(), min: widget.getMinValue(), max: widget.getMaxValue() };
    }

    if (widget instanceof Gtk.ProgressBar) {
        return { now: widget.getFraction(), min: 0, max: 1 };
    }

    return null;
};

const getWidgetValue = (widget: Gtk.Widget): WidgetValue => {
    const text = readAccessibleString(widget, "accessibleValueText");
    const live = getWidgetLiveValue(widget);

    if (live) {
        return { ...live, text };
    }

    return {
        now: readAccessibleNumber(widget, "accessibleValueNow"),
        min: readAccessibleNumber(widget, "accessibleValueMin"),
        max: readAccessibleNumber(widget, "accessibleValueMax"),
        text,
    };
};

const getWidgetOwnLabel = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, "accessibleLabel");
};

const collectAccessibleNames = (targets: Gtk.Widget[]): string[] => {
    const texts: string[] = [];

    for (const target of targets) {
        const text = getWidgetAccessibleName(target);

        if (text !== null) {
            texts.push(text);
        }
    }

    return texts;
};

const getWidgetLabelledByText = (widget: Gtk.Widget): string | null => {
    const targets = readAccessibleWidgets(widget, "accessibleLabelledBy");

    if (targets === null) {
        return null;
    }

    const texts = collectAccessibleNames(targets);

    return texts.length > 0 ? texts.join(" ") : null;
};

const isInaccessible = (widget: Gtk.Widget): boolean => {
    let current: Gtk.Widget | null = widget;

    while (current) {
        if (!current.getVisible()) {
            return true;
        }

        if (readAccessibleBoolean(current, "accessibleHidden") === true) {
            return true;
        }

        current = current.getParent();
    }

    return false;
};

export {
    getWidgetNodeText,
    getWidgetLabelText,
    getWidgetAccessibleName,
    getWidgetName,
    getWidgetPlaceholderText,
    getWidgetDisplayValue,
    getWidgetCheckedState,
    getWidgetPressedState,
    getWidgetExpandedState,
    getWidgetSelectedState,
    getWidgetLevel,
    getWidgetInvalidState,
    getWidgetErrorMessage,
    getWidgetBusyState,
    getWidgetDescription,
    getWidgetValue,
    getWidgetOwnLabel,
    getWidgetLabelledByText,
    isInaccessible,
    type WidgetValue,
};
