import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { Props } from "../reconciler/registry.js";
import { deleteAccessibleMetadata, setAccessibleMetadata } from "./accessible-metadata.js";

/**
 * Accessibility props available on every widget. Each member maps to a GTK4 accessible attribute
 * (a `Gtk.AccessibleProperty`, `Gtk.AccessibleState`, or `Gtk.AccessibleRelation`) and is applied
 * to the widget's accessible interface. Setting a member to `null` or `undefined`, or dropping it from the
 * props, resets that attribute to its default.
 */
type AccessibleProps = {
    /** How the widget completes the text being typed into it. */
    accessibleAutocomplete?: Gtk.AccessibleAutocomplete | null | undefined;
    /** Longer description announced after the label. */
    accessibleDescription?: string | null | undefined;
    /** Whether activating the widget opens a popup. */
    accessibleHasPopup?: boolean | null | undefined;
    /** Keyboard shortcuts that activate the widget. */
    accessibleKeyShortcuts?: string | null | undefined;
    /** Short name announced for the widget. */
    accessibleLabel?: string | null | undefined;
    /** Depth of the widget within a hierarchy of headings, list items, or tree rows. */
    accessibleLevel?: number | null | undefined;
    /** Whether the widget blocks interaction with everything behind it. */
    accessibleModal?: boolean | null | undefined;
    /** Whether the text input accepts more than one line. */
    accessibleMultiLine?: boolean | null | undefined;
    /** Whether more than one of the widget's items can be selected at a time. */
    accessibleMultiSelectable?: boolean | null | undefined;
    /** Whether the widget arranges its items horizontally or vertically. */
    accessibleOrientation?: Gtk.Orientation | null | undefined;
    /** Hint announced while the input is empty. */
    accessiblePlaceholder?: string | null | undefined;
    /** Whether the value can be read but not changed. */
    accessibleReadOnly?: boolean | null | undefined;
    /** Whether a value has to be supplied before the form can be submitted. */
    accessibleRequired?: boolean | null | undefined;
    /** Wording that replaces the default announcement of the widget's role. */
    accessibleRoleDescription?: string | null | undefined;
    /** Direction the widget's items are sorted in. */
    accessibleSort?: Gtk.AccessibleSort | null | undefined;
    /** Upper bound of the widget's value range. */
    accessibleValueMax?: number | null | undefined;
    /** Lower bound of the widget's value range. */
    accessibleValueMin?: number | null | undefined;
    /** Current value within the widget's range. */
    accessibleValueNow?: number | null | undefined;
    /** Wording announced in place of the numeric value. */
    accessibleValueText?: string | null | undefined;
    /** Help text describing how to use the widget. */
    accessibleHelpText?: string | null | undefined;
    /** Whether the widget is still loading and its content may yet change. */
    accessibleBusy?: boolean | null | undefined;
    /** Checked state of a check button or menu item, which may be mixed. */
    accessibleChecked?: Gtk.AccessibleTristate | null | undefined;
    /** Whether the widget is visible but cannot be edited or operated. */
    accessibleDisabled?: boolean | null | undefined;
    /** Whether the content the widget discloses is showing. */
    accessibleExpanded?: boolean | null | undefined;
    /** Whether the widget is kept out of the accessibility tree. */
    accessibleHidden?: boolean | null | undefined;
    /** Whether the entered value fails validation, and in what way. */
    accessibleInvalid?: Gtk.AccessibleInvalidState | null | undefined;
    /** Pressed state of a toggle button, which may be mixed. */
    accessiblePressed?: Gtk.AccessibleTristate | null | undefined;
    /** Whether the widget is selected within its container. */
    accessibleSelected?: boolean | null | undefined;
    /** Whether the link has already been followed. */
    accessibleVisited?: boolean | null | undefined;
    /** Descendant that holds the focus while the widget itself keeps it. */
    accessibleActiveDescendant?: Gtk.Widget | null | undefined;
    /** Total number of columns in the table, including any that are not rendered. */
    accessibleColCount?: number | null | undefined;
    /** One-based column position of the cell within its table. */
    accessibleColIndex?: number | null | undefined;
    /** Wording announced in place of the numeric column position. */
    accessibleColIndexText?: string | null | undefined;
    /** Number of columns the cell spans. */
    accessibleColSpan?: number | null | undefined;
    /** Widgets whose content or presence this widget controls. */
    accessibleControls?: Gtk.Widget[] | null | undefined;
    /** Widgets that describe this one. */
    accessibleDescribedBy?: Gtk.Widget[] | null | undefined;
    /** Widgets holding extended detail about this one. */
    accessibleDetails?: Gtk.Widget[] | null | undefined;
    /** Widgets holding the message that explains why the value is invalid. */
    accessibleErrorMessage?: Gtk.Widget[] | null | undefined;
    /** Widgets to read next, overriding the default reading order. */
    accessibleFlowTo?: Gtk.Widget[] | null | undefined;
    /** Widgets that label this one. */
    accessibleLabelledBy?: Gtk.Widget[] | null | undefined;
    /** Widgets this one owns that the widget hierarchy does not already imply. */
    accessibleOwns?: Gtk.Widget[] | null | undefined;
    /** One-based position of the widget within its set. */
    accessiblePosInSet?: number | null | undefined;
    /** Total number of rows in the table, including any that are not rendered. */
    accessibleRowCount?: number | null | undefined;
    /** One-based row position of the cell within its table. */
    accessibleRowIndex?: number | null | undefined;
    /** Wording announced in place of the numeric row position. */
    accessibleRowIndexText?: string | null | undefined;
    /** Number of rows the cell spans. */
    accessibleRowSpan?: number | null | undefined;
    /** Total number of items in the set the widget belongs to. */
    accessibleSetSize?: number | null | undefined;
};

type AccessibleValueType = "string" | "boolean" | "int" | "double" | "object" | "list";

type AccessiblePropertyDescriptor = {
    kind: "property";
    property: Gtk.AccessibleProperty;
    type: AccessibleValueType;
};

type AccessibleStateDescriptor = {
    kind: "state";
    state: Gtk.AccessibleState;
    type: AccessibleValueType;
};

type AccessibleRelationDescriptor = {
    kind: "relation";
    relation: Gtk.AccessibleRelation;
    type: AccessibleValueType;
};

type AccessibleDescriptor = AccessiblePropertyDescriptor | AccessibleStateDescriptor | AccessibleRelationDescriptor;

const ACCESSIBLE_PROP_MAP: Record<keyof AccessibleProps, AccessibleDescriptor> = {
    accessibleAutocomplete: buildProperty(Gtk.AccessibleProperty.AUTOCOMPLETE, "int"),
    accessibleDescription: buildProperty(Gtk.AccessibleProperty.DESCRIPTION, "string"),
    accessibleHasPopup: buildProperty(Gtk.AccessibleProperty.HAS_POPUP, "boolean"),
    accessibleKeyShortcuts: buildProperty(Gtk.AccessibleProperty.KEY_SHORTCUTS, "string"),
    accessibleLabel: buildProperty(Gtk.AccessibleProperty.LABEL, "string"),
    accessibleLevel: buildProperty(Gtk.AccessibleProperty.LEVEL, "int"),
    accessibleModal: buildProperty(Gtk.AccessibleProperty.MODAL, "boolean"),
    accessibleMultiLine: buildProperty(Gtk.AccessibleProperty.MULTI_LINE, "boolean"),
    accessibleMultiSelectable: buildProperty(Gtk.AccessibleProperty.MULTI_SELECTABLE, "boolean"),
    accessibleOrientation: buildProperty(Gtk.AccessibleProperty.ORIENTATION, "int"),
    accessiblePlaceholder: buildProperty(Gtk.AccessibleProperty.PLACEHOLDER, "string"),
    accessibleReadOnly: buildProperty(Gtk.AccessibleProperty.READ_ONLY, "boolean"),
    accessibleRequired: buildProperty(Gtk.AccessibleProperty.REQUIRED, "boolean"),
    accessibleRoleDescription: buildProperty(Gtk.AccessibleProperty.ROLE_DESCRIPTION, "string"),
    accessibleSort: buildProperty(Gtk.AccessibleProperty.SORT, "int"),
    accessibleValueMax: buildProperty(Gtk.AccessibleProperty.VALUE_MAX, "double"),
    accessibleValueMin: buildProperty(Gtk.AccessibleProperty.VALUE_MIN, "double"),
    accessibleValueNow: buildProperty(Gtk.AccessibleProperty.VALUE_NOW, "double"),
    accessibleValueText: buildProperty(Gtk.AccessibleProperty.VALUE_TEXT, "string"),
    accessibleHelpText: buildProperty(Gtk.AccessibleProperty.HELP_TEXT, "string"),
    accessibleBusy: buildState(Gtk.AccessibleState.BUSY, "boolean"),
    accessibleChecked: buildState(Gtk.AccessibleState.CHECKED, "int"),
    accessibleDisabled: buildState(Gtk.AccessibleState.DISABLED, "boolean"),
    accessibleExpanded: buildState(Gtk.AccessibleState.EXPANDED, "int"),
    accessibleHidden: buildState(Gtk.AccessibleState.HIDDEN, "boolean"),
    accessibleInvalid: buildState(Gtk.AccessibleState.INVALID, "int"),
    accessiblePressed: buildState(Gtk.AccessibleState.PRESSED, "int"),
    accessibleSelected: buildState(Gtk.AccessibleState.SELECTED, "int"),
    accessibleVisited: buildState(Gtk.AccessibleState.VISITED, "int"),
    accessibleActiveDescendant: buildRelation(Gtk.AccessibleRelation.ACTIVE_DESCENDANT, "object"),
    accessibleColCount: buildRelation(Gtk.AccessibleRelation.COL_COUNT, "int"),
    accessibleColIndex: buildRelation(Gtk.AccessibleRelation.COL_INDEX, "int"),
    accessibleColIndexText: buildRelation(Gtk.AccessibleRelation.COL_INDEX_TEXT, "string"),
    accessibleColSpan: buildRelation(Gtk.AccessibleRelation.COL_SPAN, "int"),
    accessibleControls: buildRelation(Gtk.AccessibleRelation.CONTROLS, "list"),
    accessibleDescribedBy: buildRelation(Gtk.AccessibleRelation.DESCRIBED_BY, "list"),
    accessibleDetails: buildRelation(Gtk.AccessibleRelation.DETAILS, "list"),
    accessibleErrorMessage: buildRelation(Gtk.AccessibleRelation.ERROR_MESSAGE, "list"),
    accessibleFlowTo: buildRelation(Gtk.AccessibleRelation.FLOW_TO, "list"),
    accessibleLabelledBy: buildRelation(Gtk.AccessibleRelation.LABELLED_BY, "list"),
    accessibleOwns: buildRelation(Gtk.AccessibleRelation.OWNS, "list"),
    accessiblePosInSet: buildRelation(Gtk.AccessibleRelation.POS_IN_SET, "int"),
    accessibleRowCount: buildRelation(Gtk.AccessibleRelation.ROW_COUNT, "int"),
    accessibleRowIndex: buildRelation(Gtk.AccessibleRelation.ROW_INDEX, "int"),
    accessibleRowIndexText: buildRelation(Gtk.AccessibleRelation.ROW_INDEX_TEXT, "string"),
    accessibleRowSpan: buildRelation(Gtk.AccessibleRelation.ROW_SPAN, "int"),
    accessibleSetSize: buildRelation(Gtk.AccessibleRelation.SET_SIZE, "int"),
};

function buildProperty(property: Gtk.AccessibleProperty, type: AccessibleValueType): AccessiblePropertyDescriptor {
    return {
        kind: "property",
        property,
        type,
    };
}

function buildState(state: Gtk.AccessibleState, type: AccessibleValueType): AccessibleStateDescriptor {
    return {
        kind: "state",
        state,
        type,
    };
}

function buildRelation(relation: Gtk.AccessibleRelation, type: AccessibleValueType): AccessibleRelationDescriptor {
    return {
        kind: "relation",
        relation,
        type,
    };
}

const buildValue = (descriptor: AccessibleDescriptor, jsValue: unknown): GObject.Value => {
    switch (descriptor.type) {
        case "string": {
            return GObject.buildValue(GObject.TYPE_STRING, (v) => {
                v.setString(jsValue as string);
            });
        }
        case "boolean": {
            return GObject.buildValue(GObject.TYPE_BOOLEAN, (v) => {
                v.setBoolean(jsValue as boolean);
            });
        }
        case "int": {
            return GObject.buildValue(GObject.TYPE_INT, (v) => {
                v.setInt(jsValue as number);
            });
        }
        case "double": {
            return GObject.buildValue(GObject.TYPE_DOUBLE, (v) => {
                v.setDouble(jsValue as number);
            });
        }
        case "object": {
            return GObject.buildValue(GObject.TYPE_OBJECT, (v) => {
                v.setObject(jsValue as GObject.Object | null);
            });
        }
        case "list": {
            const list = Gtk.AccessibleList.newFromList(jsValue as Gtk.Widget[]);

            return GObject.buildValue(Gtk.AccessibleList.prototype.__type__, (v) => {
                v.setBoxed(list);
            });
        }
    }
};

const isAccessibleProp = (name: string): name is keyof AccessibleProps =>
    Object.hasOwn(ACCESSIBLE_PROP_MAP, name);

function applyDescriptor(widget: Gtk.Accessible, descriptor: AccessibleDescriptor, newValue: unknown): void {
    const value = buildValue(descriptor, newValue);

    switch (descriptor.kind) {
        case "property": {
            widget.updateProperty([descriptor.property], [value]);
            break;
        }
        case "state": {
            widget.updateState([descriptor.state], [value]);
            break;
        }
        case "relation": {
            widget.updateRelation([descriptor.relation], [value]);
            break;
        }
    }
}

function resetDescriptor(widget: Gtk.Accessible, descriptor: AccessibleDescriptor): void {
    switch (descriptor.kind) {
        case "property": {
            widget.resetProperty(descriptor.property);
            break;
        }
        case "state": {
            widget.resetState(descriptor.state);
            break;
        }
        case "relation": {
            widget.resetRelation(descriptor.relation);
            break;
        }
    }
}

const applyChangedProp = (widget: Gtk.Accessible, name: keyof AccessibleProps, newValue: unknown): void => {
    if (newValue == null) {
        resetDescriptor(widget, ACCESSIBLE_PROP_MAP[name]);
        deleteAccessibleMetadata(widget, name);
    } else {
        applyDescriptor(widget, ACCESSIBLE_PROP_MAP[name], newValue);
        setAccessibleMetadata(widget, name, newValue);
    }
};

const applyChangedProps = (widget: Gtk.Accessible, oldProps: Props | null, newProps: Props): void => {
    for (const name in newProps) {
        if (!isAccessibleProp(name)) {
            continue;
        }

        const newValue = newProps[name];

        if (oldProps?.[name] !== newValue) {
            applyChangedProp(widget, name, newValue);
        }
    }
};

const isRemovedAccessibleProp = (name: string, oldProps: Props, newProps: Props): name is keyof AccessibleProps =>
    !Object.hasOwn(newProps, name) && isAccessibleProp(name) && oldProps[name] !== undefined;

const resetRemovedProps = (widget: Gtk.Accessible, oldProps: Props, newProps: Props): void => {
    for (const name in oldProps) {
        if (!isRemovedAccessibleProp(name, oldProps, newProps)) {
            continue;
        }

        resetDescriptor(widget, ACCESSIBLE_PROP_MAP[name]);
        deleteAccessibleMetadata(widget, name);
    }
};

const applyAccessibleProps = (widget: Gtk.Accessible, oldProps: Props | null, newProps: Props): void => {
    applyChangedProps(widget, oldProps, newProps);

    if (oldProps) {
        resetRemovedProps(widget, oldProps, newProps);
    }
};

export { isAccessibleProp, applyAccessibleProps, type AccessibleProps };
