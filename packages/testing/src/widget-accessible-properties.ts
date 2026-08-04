import * as Gtk from "@gtkx/gi/gtk";
import { getAccessibleMetadata } from "@gtkx/react/internal";
import { EDITABLE_ROLES, isEditable, readEditableText } from "./editable.js";
import { isTextHidden, REDACTED_TEXT, redactText } from "./hidden-text.js";
import { descendants } from "./traversal.js";

type WidgetValue = {
    now: number | null;
    min: number | null;
    max: number | null;
    text: string | null;
};

type ValueTriplet = { now: number | null; min: number | null; max: number | null };
type CheckedState = "checked" | "unchecked" | "mixed";

const EDITABLE_TEXT_GETTER = "getText";
const DEFAULT_TEXT_GETTERS = ["getLabel", EDITABLE_TEXT_GETTER, "getTitle"];
const LABELLING_TEXT_GETTERS = DEFAULT_TEXT_GETTERS.filter((getter) => getter !== EDITABLE_TEXT_GETTER);

const SELECTABLE_ROLES: Set<Gtk.AccessibleRole> = new Set<Gtk.AccessibleRole>([
    Gtk.AccessibleRole.ROW,
    Gtk.AccessibleRole.LIST_ITEM,
    Gtk.AccessibleRole.GRID_CELL,
    Gtk.AccessibleRole.OPTION,
    Gtk.AccessibleRole.TREE_ITEM,
]);

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

const stripMnemonic = (text: string): string => text.replaceAll(/_(.)/g, "$1");

const isUnderlineUsed = (widget: Gtk.Widget): boolean => {
    const fn: unknown = Reflect.get(widget, "getUseUnderline");

    return typeof fn === "function" && (fn as () => boolean).call(widget);
};

const readNamingText = (widget: Gtk.Widget, getter: string, value: string): string =>
    getter !== EDITABLE_TEXT_GETTER && isUnderlineUsed(widget) ? stripMnemonic(value) : value;

const readFirstText = (widget: Gtk.Widget, getters: string[]): string | null => {
    for (const getter of getters) {
        const value = callStringGetter(widget, getter);

        if (value) {
            return readNamingText(widget, getter, value);
        }
    }

    return null;
};

const getHiddenNodeText = (widget: Gtk.Widget): string | null => {
    const labelling = readFirstText(widget, LABELLING_TEXT_GETTERS);

    if (labelling !== null) {
        return labelling;
    }

    return callStringGetter(widget, EDITABLE_TEXT_GETTER) ? REDACTED_TEXT : null;
};

/**
 * Returns a widget's own text by trying its label, text, and title getters in
 * order, or null when none produce a value. Text the widget hides, such as a
 * password entry's contents, is reported as `REDACTED_TEXT` instead.
 *
 * @param widget The widget to read text from.
 */
const getWidgetNodeText = (widget: Gtk.Widget): string | null => {
    if (isTextHidden(widget)) {
        return getHiddenNodeText(widget);
    }

    return readFirstText(widget, DEFAULT_TEXT_GETTERS);
};

const namingLabelText = (widget: Gtk.Widget): string | null => {
    const text = getLabelText(widget);

    if (text === null) {
        return null;
    }

    return isUnderlineUsed(widget) ? stripMnemonic(text) : text;
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

    return namingLabelText(widget);
};

const getChildren = function* (widget: Gtk.Widget): Generator<Gtk.Widget> {
    let child = widget.getFirstChild();

    while (child) {
        yield child;
        child = child.getNextSibling();
    }
};

const textContentParts = (widget: Gtk.Widget): string[] => {
    const own = getWidgetNodeText(widget);

    if (own !== null) {
        return [own];
    }

    return [...getChildren(widget)].flatMap((child) => textContentParts(child));
};

/**
 * Returns a widget's own text, or the space-joined text of its descendants when it has none of its
 * own, or null when neither produces a value.
 *
 * @param widget The widget whose subtree is read.
 */
const getWidgetTextContent = (widget: Gtk.Widget): string | null => {
    const parts = textContentParts(widget);

    return parts.length > 0 ? parts.join(" ") : null;
};

const isComboBoxFaceCandidate = (widget: Gtk.Widget): boolean =>
    !(widget instanceof Gtk.Popover) && widget.getChildVisible();

const comboBoxChildFaceText = (child: Gtk.Widget): string | null =>
    isComboBoxFaceCandidate(child) ? getWidgetLabelText(child) ?? comboBoxFaceText(child) : null;

const comboBoxFaceText = (widget: Gtk.Widget): string | null => {
    for (const child of getChildren(widget)) {
        const text = comboBoxChildFaceText(child);

        if (text !== null) {
            return text;
        }
    }

    return null;
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

    const labelledByText = getWidgetLabelledByText(widget);

    if (labelledByText) {
        return labelledByText;
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

    const fromGetter = callStringGetter(widget, "getPlaceholderText");

    if (fromGetter !== null) {
        return fromGetter;
    }

    const fromAccessor: unknown = Reflect.get(widget, "placeholderText");

    return typeof fromAccessor === "string" && fromAccessor !== "" ? fromAccessor : null;
};

const getWidgetDisplayValue = (widget: Gtk.Widget): string | null => {
    if (EDITABLE_ROLES.has(widget.getAccessibleRole()) && isEditable(widget)) {
        return redactText(widget, readEditableText(widget));
    }

    if (widget.getAccessibleRole() === Gtk.AccessibleRole.COMBO_BOX) {
        return comboBoxFaceText(widget);
    }

    return null;
};

const hasDisplayValue = (widget: Gtk.Widget): boolean => {
    const role = widget.getAccessibleRole();

    return (EDITABLE_ROLES.has(role) && isEditable(widget)) || role === Gtk.AccessibleRole.COMBO_BOX;
};

const isWidgetDisabled = (widget: Gtk.Widget): boolean => !widget.isSensitive();

const hasZeroOpacityAncestor = (widget: Gtk.Widget): boolean => {
    let current: Gtk.Widget | null = widget;

    while (current) {
        if (current.getOpacity() === 0) {
            return true;
        }

        current = current.getParent();
    }

    return false;
};

const isWidgetVisible = (widget: Gtk.Widget): boolean => widget.isVisible() && !hasZeroOpacityAncestor(widget);

const getWidgetRequiredState = (widget: Gtk.Widget): boolean | null =>
    readAccessibleBoolean(widget, "accessibleRequired");

const readTextViewSelection = (view: Gtk.TextView): string | null => {
    const buffer = view.getBuffer();
    const [hasSelection, start, end] = buffer.getSelectionBounds();

    return hasSelection ? buffer.getText(start, end, true) : null;
};

const readEditableSelection = (editable: Gtk.Editable): string | null => {
    const [hasSelection, start, end] = editable.getSelectionBounds();

    return hasSelection ? editable.getChars(start, end) : null;
};

const getWidgetSelection = (widget: Gtk.Widget): string | null => {
    if (widget instanceof Gtk.TextView) {
        return readTextViewSelection(widget);
    }

    if (widget instanceof Gtk.Editable) {
        return redactText(widget, readEditableSelection(widget));
    }

    return null;
};

const checkedFromActive = (isActive: boolean): CheckedState => (isActive ? "checked" : "unchecked");

const isCheckableToggle = (widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.Switch ||
    (widget instanceof Gtk.ToggleButton && widget.getAccessibleRole() === Gtk.AccessibleRole.RADIO);

const getWidgetCheckedState = (widget: Gtk.Widget): CheckedState | null => {
    if (widget instanceof Gtk.CheckButton) {
        return widget.getInconsistent() ? "mixed" : checkedFromActive(widget.getActive());
    }

    if (isCheckableToggle(widget)) {
        return checkedFromActive(Reflect.get(widget, "active") === true);
    }

    return null;
};

const isWidgetChecked = (widget: Gtk.Widget): boolean | null => {
    const state = getWidgetCheckedState(widget);

    return state === null || state === "mixed" ? null : state === "checked";
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
    if (widget instanceof Gtk.ListBoxRow || widget instanceof Gtk.FlowBoxChild) {
        return widget.isSelected();
    }

    if (SELECTABLE_ROLES.has(widget.getAccessibleRole())) {
        return (widget.getStateFlags() & Gtk.StateFlags.SELECTED) !== 0;
    }

    return null;
};

const getWidgetLevel = (widget: Gtk.Widget): number | null => {
    return readAccessibleNumber(widget, "accessibleLevel");
};

/**
 * Returns the accessible invalid state declared on a widget, or null when it declares none.
 *
 * @param widget The widget to read the state from.
 */
const getWidgetInvalidState = (widget: Gtk.Widget): Gtk.AccessibleInvalidState | null => {
    const value = readAccessibleNumber(widget, "accessibleInvalid");

    return value ?? null;
};

/**
 * Returns the widgets a widget's accessible error-message relation points at, or null when it
 * declares none.
 *
 * @param widget The widget to read the relation from.
 */
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

const isTooltipUsedAsName = (widget: Gtk.Widget): boolean =>
    readAccessibleString(widget, "accessibleLabel") === null &&
    getWidgetNodeText(widget) === null &&
    collectLabels(widget).length === 0;

const getWidgetDescribedByText = (widget: Gtk.Widget): string | null => {
    const targets = readAccessibleWidgets(widget, "accessibleDescribedBy");
    const texts = targets === null ? [] : collectAccessibleNames(targets);

    if (texts.length > 0) {
        return texts.join(" ");
    }

    const description = readAccessibleString(widget, "accessibleDescription");

    if (description !== null) {
        return description;
    }

    return isTooltipUsedAsName(widget) ? null : callStringGetter(widget, "getTooltipText");
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
    namingLabelText,
    getWidgetNodeText,
    getWidgetTextContent,
    getWidgetLabelText,
    getWidgetAccessibleName,
    getWidgetName,
    getWidgetPlaceholderText,
    getWidgetDisplayValue,
    hasDisplayValue,
    isWidgetDisabled,
    isWidgetVisible,
    getWidgetRequiredState,
    getWidgetSelection,
    getWidgetDescribedByText,
    getWidgetCheckedState,
    isWidgetChecked,
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
    type CheckedState,
    type WidgetValue,
};
