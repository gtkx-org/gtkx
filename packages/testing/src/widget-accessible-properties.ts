import * as Gtk from "@gtkx/gi/gtk";
import {
    isAccessibleNumberMatch,
    readAccessibleBooleanProperty,
    readAccessibleFlag,
    readAccessibleInt,
    readAccessibleRelation,
    readAccessibleState,
    readAccessibleNumber as readNativeNumber,
    readAccessibleString as readNativeString,
} from "./accessible-native.js";
import { EDITABLE_ROLES, isEditable, readEditableText } from "./editable.js";
import { isNameFromAuthor, isNameProhibited } from "./role-naming.js";
import { descendants, relationCandidates } from "./traversal.js";
import { callBooleanGetter, callStringGetter, getCallableMethod } from "./widget-getters.js";

type WidgetValueField = "now" | "min" | "max";
type CheckedState = "checked" | "unchecked" | "mixed";

const EDITABLE_TEXT_GETTER = "getText";
const DEFAULT_TEXT_GETTERS = ["getLabel", EDITABLE_TEXT_GETTER, "getTitle"];

const SELECTABLE_ROLES: Set<Gtk.AccessibleRole> = new Set<Gtk.AccessibleRole>([
    Gtk.AccessibleRole.ROW,
    Gtk.AccessibleRole.LIST_ITEM,
    Gtk.AccessibleRole.GRID_CELL,
    Gtk.AccessibleRole.OPTION,
    Gtk.AccessibleRole.TREE_ITEM,
]);

const PRESSED_BY_TRISTATE: Map<number, boolean> = new Map<number, boolean>([
    [Gtk.AccessibleTristate.FALSE, false],
    [Gtk.AccessibleTristate.TRUE, true],
]);

const CHECKED_BY_TRISTATE: Map<number, CheckedState> = new Map<number, CheckedState>([
    [Gtk.AccessibleTristate.FALSE, "unchecked"],
    [Gtk.AccessibleTristate.TRUE, "checked"],
    [Gtk.AccessibleTristate.MIXED, "mixed"],
]);

const VALUE_PROPERTIES: Record<WidgetValueField, Gtk.AccessibleProperty> = {
    now: Gtk.AccessibleProperty.VALUE_NOW,
    min: Gtk.AccessibleProperty.VALUE_MIN,
    max: Gtk.AccessibleProperty.VALUE_MAX,
};

const readAccessibleString = (widget: Gtk.Widget, property: Gtk.AccessibleProperty): string | null =>
    readNativeString(widget, property);

const readAccessibleNumber = (widget: Gtk.Widget, property: Gtk.AccessibleProperty): number | null =>
    readNativeNumber(widget, property);

const readAccessibleWidgets = (widget: Gtk.Widget, relation: Gtk.AccessibleRelation): Gtk.Widget[] | null => {
    const targets = readAccessibleRelation(widget, relation, relationCandidates(widget));
    const widgets = targets.filter((target): target is Gtk.Widget => target instanceof Gtk.Widget);

    return widgets.length > 0 ? widgets : null;
};

const readAccessibleBoolean = (widget: Gtk.Widget, state: Gtk.AccessibleState): boolean | null =>
    readAccessibleFlag(widget, state);

const getLabelText = (widget: Gtk.Widget): string | null => {
    if (widget instanceof Gtk.Label) {
        return widget.getLabel();
    }

    return readAccessibleString(widget, Gtk.AccessibleProperty.LABEL);
};

const stripMnemonic = (text: string): string => text.replaceAll(/_(.)/g, "$1");
const isUnderlineUsed = (widget: Gtk.Widget): boolean => callBooleanGetter(widget, "getUseUnderline") ?? false;

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

/**
 * Returns a widget's own text by trying its label, text, and title getters in
 * order, or null when none produce a value.
 *
 * @param widget The widget to read text from.
 */
const getWidgetText = (widget: Gtk.Widget): string | null => readFirstText(widget, DEFAULT_TEXT_GETTERS);

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
    const own = getWidgetText(widget);

    if (own !== null) {
        return [own];
    }

    return [...getChildren(widget)].flatMap((child) => textContentParts(child));
};

const getWidgetTextContent = (widget: Gtk.Widget): string | null => {
    const parts = textContentParts(widget);

    return parts.length > 0 ? parts.join(" ") : null;
};

const isDropDownFaceCandidate = (widget: Gtk.Widget): boolean =>
    !(widget instanceof Gtk.Popover) && widget.getChildVisible();

const dropDownChildFaceText = (child: Gtk.Widget): string | null =>
    isDropDownFaceCandidate(child) ? getWidgetLabelText(child) ?? dropDownFaceText(child) : null;

const dropDownFaceText = (widget: Gtk.Widget): string | null => {
    for (const child of getChildren(widget)) {
        const text = dropDownChildFaceText(child);

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

const nameFromAuthor = (widget: Gtk.Widget): string | null =>
    getWidgetLabelledByText(widget) ?? readAccessibleString(widget, Gtk.AccessibleProperty.LABEL);

const nameFromContent = (widget: Gtk.Widget): string | null => {
    const ownText = getWidgetText(widget);

    if (ownText) {
        return ownText;
    }

    const childLabels = collectLabels(widget);

    return childLabels.length > 0 ? childLabels.join(" ") : null;
};

const getWidgetAccessibleName = (widget: Gtk.Widget): string | null => {
    const role = widget.getAccessibleRole();

    if (isNameProhibited(role)) {
        return null;
    }

    if (role === Gtk.AccessibleRole.TAB_PANEL) {
        return tabPanelTitle(widget);
    }

    const authored = isNameFromAuthor(role) ? nameFromAuthor(widget) : null;

    if (authored) {
        return authored;
    }

    return nameFromContent(widget) ?? callStringGetter(widget, "getTooltipText");
};

const getWidgetName = (widget: Gtk.Widget): string | null => {
    return widget.getName();
};

const nonEmptyText = (text: string | null): string | null => (text === null || text === "" ? null : text);

const readPlaceholderProperty = (widget: Gtk.Widget): string | null => {
    const value: unknown = Reflect.get(widget, "placeholderText");

    return typeof value === "string" ? nonEmptyText(value) : null;
};

const getWidgetPlaceholderText = (widget: Gtk.Widget): string | null => {
    if (!EDITABLE_ROLES.has(widget.getAccessibleRole())) {
        return null;
    }

    return (
        nonEmptyText(callStringGetter(widget, "getPlaceholderText")) ??
        readPlaceholderProperty(widget) ??
        nonEmptyText(readAccessibleString(widget, Gtk.AccessibleProperty.PLACEHOLDER))
    );
};

const getWidgetDisplayValue = (widget: Gtk.Widget): string | null => {
    if (EDITABLE_ROLES.has(widget.getAccessibleRole()) && isEditable(widget)) {
        return readEditableText(widget);
    }

    if (widget.getAccessibleRole() === Gtk.AccessibleRole.COMBO_BOX) {
        return readAccessibleString(widget, Gtk.AccessibleProperty.VALUE_TEXT) ?? dropDownFaceText(widget);
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
    readAccessibleBooleanProperty(widget, Gtk.AccessibleProperty.REQUIRED);

const readTextViewSelection = (view: Gtk.TextView): string | null => {
    const buffer = view.getBuffer();
    const [hasSelection, start, end] = buffer.getSelectionBounds();

    return hasSelection ? buffer.getText(start, end, true) : null;
};

const sliceSelectedText = (widget: Gtk.Widget, start: number, end: number): string | null => {
    const chars = getCallableMethod<[number, number], string | null>(widget, "getChars");

    if (chars) {
        return chars(start, end) ?? null;
    }

    const text = callStringGetter(widget, "getText");

    /* eslint-disable-next-line @typescript-eslint/no-misused-spread -- bounds are code point offsets */
    return text === null ? null : [...text].slice(start, end).join("");
};

const readBoundedSelection = (widget: Gtk.Widget): string | null => {
    const bounds = getCallableMethod<[], [boolean, number, number]>(widget, "getSelectionBounds");

    if (!bounds) {
        return null;
    }

    const [hasSelection, start, end] = bounds();

    return hasSelection ? sliceSelectedText(widget, start, end) : null;
};

const getWidgetSelection = (widget: Gtk.Widget): string | null =>
    widget instanceof Gtk.TextView ? readTextViewSelection(widget) : readBoundedSelection(widget);

const checkedFromActive = (isActive: boolean): CheckedState => (isActive ? "checked" : "unchecked");

const isRadioToggle = (widget: Gtk.Widget): widget is Gtk.ToggleButton =>
    widget instanceof Gtk.ToggleButton && widget.getAccessibleRole() === Gtk.AccessibleRole.RADIO;

const getWidgetCheckedState = (widget: Gtk.Widget): CheckedState | null => {
    const tristate = readAccessibleState(widget, Gtk.AccessibleState.CHECKED);
    const state = tristate === null ? undefined : CHECKED_BY_TRISTATE.get(tristate);

    if (state !== undefined) {
        return state;
    }

    return isRadioToggle(widget) ? checkedFromActive(widget.getActive()) : null;
};

const isWidgetChecked = (widget: Gtk.Widget): boolean | null => {
    const state = getWidgetCheckedState(widget);

    return state === null || state === "mixed" ? null : state === "checked";
};

const getWidgetPressedState = (widget: Gtk.Widget): boolean | null => {
    const tristate = readAccessibleState(widget, Gtk.AccessibleState.PRESSED);

    return tristate === null ? null : PRESSED_BY_TRISTATE.get(tristate) ?? null;
};

const getWidgetExpandedState = (widget: Gtk.Widget): boolean | null => {
    if (widget instanceof Gtk.TreeExpander) {
        return widget.getListRow()?.getExpanded() ?? null;
    }

    return readAccessibleBoolean(widget, Gtk.AccessibleState.EXPANDED);
};

const getWidgetSelectedState = (widget: Gtk.Widget): boolean | null => {
    const selected = readAccessibleBoolean(widget, Gtk.AccessibleState.SELECTED);

    if (selected !== null) {
        return selected;
    }

    if (SELECTABLE_ROLES.has(widget.getAccessibleRole())) {
        return (widget.getStateFlags() & Gtk.StateFlags.SELECTED) !== 0;
    }

    return null;
};

const getWidgetLevel = (widget: Gtk.Widget): number | null => {
    return readAccessibleInt(widget, Gtk.AccessibleProperty.LEVEL);
};

const getWidgetInvalidState = (widget: Gtk.Widget): Gtk.AccessibleInvalidState | null => {
    const value = readAccessibleState(widget, Gtk.AccessibleState.INVALID);

    return value ?? null;
};

const getWidgetErrorMessage = (widget: Gtk.Widget): Gtk.Widget[] | null =>
    readAccessibleWidgets(widget, Gtk.AccessibleRelation.ERROR_MESSAGE);

const getWidgetBusyState = (widget: Gtk.Widget): boolean | null => {
    return readAccessibleBoolean(widget, Gtk.AccessibleState.BUSY);
};

const getWidgetDescription = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, Gtk.AccessibleProperty.DESCRIPTION);
};

const getWidgetValueNow = (widget: Gtk.Widget): number | null =>
    readAccessibleNumber(widget, Gtk.AccessibleProperty.VALUE_NOW);

const getWidgetValueText = (widget: Gtk.Widget): string | null =>
    readAccessibleString(widget, Gtk.AccessibleProperty.VALUE_TEXT);

const isWidgetValueMatch = (widget: Gtk.Widget, field: WidgetValueField, expected: number): boolean =>
    isAccessibleNumberMatch(widget, VALUE_PROPERTIES[field], expected);

const getWidgetOwnLabel = (widget: Gtk.Widget): string | null => {
    return readAccessibleString(widget, Gtk.AccessibleProperty.LABEL);
};

const collectAccessibleNames = (targets: Gtk.Widget[]): string[] => {
    const texts: string[] = [];

    for (const target of targets) {
        const text = getWidgetAccessibleName(target);

        if (text) {
            texts.push(text);
        }
    }

    return texts;
};

const isSelfLabelling = (widget: Gtk.Widget, targets: Gtk.Widget[]): boolean => {
    const own = new Set(descendants(widget));

    return targets.every((target) => own.has(target));
};

const getWidgetLabelledByText = (widget: Gtk.Widget): string | null => {
    const targets = readAccessibleWidgets(widget, Gtk.AccessibleRelation.LABELLED_BY);

    if (targets === null) {
        return null;
    }

    const texts = collectAccessibleNames(targets);

    return texts.length > 0 ? texts.join(" ") : null;
};

const getWidgetExternalLabelText = (widget: Gtk.Widget): string | null => {
    const targets = readAccessibleWidgets(widget, Gtk.AccessibleRelation.LABELLED_BY);

    return targets === null || isSelfLabelling(widget, targets) ? null : getWidgetLabelledByText(widget);
};

const isTooltipUsedAsName = (widget: Gtk.Widget): boolean =>
    readAccessibleString(widget, Gtk.AccessibleProperty.LABEL) === null &&
    getWidgetText(widget) === null &&
    collectLabels(widget).length === 0;

const getWidgetDescribedByText = (widget: Gtk.Widget): string | null => {
    const targets = readAccessibleWidgets(widget, Gtk.AccessibleRelation.DESCRIBED_BY);
    const texts = targets === null ? [] : collectAccessibleNames(targets);

    if (texts.length > 0) {
        return texts.join(" ");
    }

    const description = readAccessibleString(widget, Gtk.AccessibleProperty.DESCRIPTION);

    if (description !== null) {
        return description;
    }

    return isTooltipUsedAsName(widget) ? null : callStringGetter(widget, "getTooltipText");
};

/**
 * Returns whether a widget is excluded from the accessibility tree, because it or one of its
 * ancestors is marked hidden.
 *
 * @param widget The widget to test.
 */
const isInaccessible = (widget: Gtk.Widget): boolean => {
    let current: Gtk.Widget | null = widget;

    while (current) {
        if (readAccessibleBoolean(current, Gtk.AccessibleState.HIDDEN) === true) {
            return true;
        }

        current = current.getParent();
    }

    return false;
};

export {
    namingLabelText,
    getWidgetText,
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
    getWidgetValueNow,
    getWidgetValueText,
    getWidgetOwnLabel,
    getWidgetExternalLabelText,
    getWidgetLabelledByText,
    isInaccessible,
    isWidgetValueMatch,
    type CheckedState,
    type WidgetValueField,
};
