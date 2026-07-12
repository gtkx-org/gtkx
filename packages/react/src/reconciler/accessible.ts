import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { deleteAccessibleMetadata, setAccessibleMetadata } from "../utils/accessible-metadata.js";
import type { Props } from "./types.js";

/**
 * Accessibility props available on every widget. Each member maps to a GTK accessible attribute
 * (a `Gtk.AccessibleProperty`, `Gtk.AccessibleState`, or `Gtk.AccessibleRelation`) and is applied
 * to the widget's accessible interface; setting a member to `undefined` resets that attribute to its default.
 */
export interface AccessibleProps {
    accessibleAutocomplete?: Gtk.AccessibleAutocomplete | null | undefined;
    accessibleDescription?: string | null | undefined;
    accessibleHasPopup?: boolean | null | undefined;
    accessibleKeyShortcuts?: string | null | undefined;
    accessibleLabel?: string | null | undefined;
    accessibleLevel?: number | null | undefined;
    accessibleModal?: boolean | null | undefined;
    accessibleMultiLine?: boolean | null | undefined;
    accessibleMultiSelectable?: boolean | null | undefined;
    accessibleOrientation?: Gtk.Orientation | null | undefined;
    accessiblePlaceholder?: string | null | undefined;
    accessibleReadOnly?: boolean | null | undefined;
    accessibleRequired?: boolean | null | undefined;
    accessibleRoleDescription?: string | null | undefined;
    accessibleSort?: Gtk.AccessibleSort | null | undefined;
    accessibleValueMax?: number | null | undefined;
    accessibleValueMin?: number | null | undefined;
    accessibleValueNow?: number | null | undefined;
    accessibleValueText?: string | null | undefined;
    accessibleHelpText?: string | null | undefined;
    accessibleBusy?: boolean | null | undefined;
    accessibleChecked?: Gtk.AccessibleTristate | null | undefined;
    accessibleDisabled?: boolean | null | undefined;
    accessibleExpanded?: boolean | null | undefined;
    accessibleHidden?: boolean | null | undefined;
    accessibleInvalid?: Gtk.AccessibleInvalidState | null | undefined;
    accessiblePressed?: Gtk.AccessibleTristate | null | undefined;
    accessibleSelected?: boolean | null | undefined;
    accessibleVisited?: boolean | null | undefined;
    accessibleActiveDescendant?: Gtk.Widget | null | undefined;
    accessibleColCount?: number | null | undefined;
    accessibleColIndex?: number | null | undefined;
    accessibleColIndexText?: string | null | undefined;
    accessibleColSpan?: number | null | undefined;
    accessibleControls?: Gtk.Widget[] | null | undefined;
    accessibleDescribedBy?: Gtk.Widget[] | null | undefined;
    accessibleDetails?: Gtk.Widget[] | null | undefined;
    accessibleErrorMessage?: Gtk.Widget[] | null | undefined;
    accessibleFlowTo?: Gtk.Widget[] | null | undefined;
    accessibleLabelledBy?: Gtk.Widget[] | null | undefined;
    accessibleOwns?: Gtk.Widget[] | null | undefined;
    accessiblePosInSet?: number | null | undefined;
    accessibleRowCount?: number | null | undefined;
    accessibleRowIndex?: number | null | undefined;
    accessibleRowIndexText?: string | null | undefined;
    accessibleRowSpan?: number | null | undefined;
    accessibleSetSize?: number | null | undefined;
}

type CreateValue = (jsValue: unknown) => GObject.Value;

type AccessiblePropertyDescriptor = {
    kind: "property";
    enumValue: Gtk.AccessibleProperty;
    createValue: CreateValue;
};

type AccessibleStateDescriptor = {
    kind: "state";
    enumValue: Gtk.AccessibleState;
    createValue: CreateValue;
};

type AccessibleRelationDescriptor = {
    kind: "relation";
    enumValue: Gtk.AccessibleRelation;
    createValue: CreateValue;
};

type AccessibleDescriptor = AccessiblePropertyDescriptor | AccessibleStateDescriptor | AccessibleRelationDescriptor;

const fromString: CreateValue = (val) => GObject.buildValue(GObject.TYPE_STRING, (v) => v.setString(val as string));
const fromBoolean: CreateValue = (val) => GObject.buildValue(GObject.TYPE_BOOLEAN, (v) => v.setBoolean(val as boolean));
const fromInt: CreateValue = (val) => GObject.buildValue(GObject.TYPE_INT, (v) => v.setInt(val as number));
const fromDouble: CreateValue = (val) => GObject.buildValue(GObject.TYPE_DOUBLE, (v) => v.setDouble(val as number));
const fromObject: CreateValue = (val) =>
    GObject.buildValue(GObject.TYPE_OBJECT, (v) => v.setObject(val as GObject.Object));

const fromRefList: CreateValue = (val) => {
    const widgets = val as Gtk.Accessible[];
    const list = Gtk.AccessibleList.newFromList(widgets);
    return GObject.buildValue(Gtk.AccessibleList.prototype.__type__, (v) => v.setBoxed(list));
};

const property = (enumValue: Gtk.AccessibleProperty, createValue: CreateValue): AccessiblePropertyDescriptor => ({
    kind: "property",
    enumValue,
    createValue,
});

const state = (enumValue: Gtk.AccessibleState, createValue: CreateValue): AccessibleStateDescriptor => ({
    kind: "state",
    enumValue,
    createValue,
});

const relation = (enumValue: Gtk.AccessibleRelation, createValue: CreateValue): AccessibleRelationDescriptor => ({
    kind: "relation",
    enumValue,
    createValue,
});

const ACCESSIBLE_PROP_MAP: Record<keyof AccessibleProps, AccessibleDescriptor> = {
    accessibleAutocomplete: property(Gtk.AccessibleProperty.AUTOCOMPLETE, fromInt),
    accessibleDescription: property(Gtk.AccessibleProperty.DESCRIPTION, fromString),
    accessibleHasPopup: property(Gtk.AccessibleProperty.HAS_POPUP, fromBoolean),
    accessibleKeyShortcuts: property(Gtk.AccessibleProperty.KEY_SHORTCUTS, fromString),
    accessibleLabel: property(Gtk.AccessibleProperty.LABEL, fromString),
    accessibleLevel: property(Gtk.AccessibleProperty.LEVEL, fromInt),
    accessibleModal: property(Gtk.AccessibleProperty.MODAL, fromBoolean),
    accessibleMultiLine: property(Gtk.AccessibleProperty.MULTI_LINE, fromBoolean),
    accessibleMultiSelectable: property(Gtk.AccessibleProperty.MULTI_SELECTABLE, fromBoolean),
    accessibleOrientation: property(Gtk.AccessibleProperty.ORIENTATION, fromInt),
    accessiblePlaceholder: property(Gtk.AccessibleProperty.PLACEHOLDER, fromString),
    accessibleReadOnly: property(Gtk.AccessibleProperty.READ_ONLY, fromBoolean),
    accessibleRequired: property(Gtk.AccessibleProperty.REQUIRED, fromBoolean),
    accessibleRoleDescription: property(Gtk.AccessibleProperty.ROLE_DESCRIPTION, fromString),
    accessibleSort: property(Gtk.AccessibleProperty.SORT, fromInt),
    accessibleValueMax: property(Gtk.AccessibleProperty.VALUE_MAX, fromDouble),
    accessibleValueMin: property(Gtk.AccessibleProperty.VALUE_MIN, fromDouble),
    accessibleValueNow: property(Gtk.AccessibleProperty.VALUE_NOW, fromDouble),
    accessibleValueText: property(Gtk.AccessibleProperty.VALUE_TEXT, fromString),
    accessibleHelpText: property(Gtk.AccessibleProperty.HELP_TEXT, fromString),
    accessibleBusy: state(Gtk.AccessibleState.BUSY, fromBoolean),
    accessibleChecked: state(Gtk.AccessibleState.CHECKED, fromInt),
    accessibleDisabled: state(Gtk.AccessibleState.DISABLED, fromBoolean),
    accessibleExpanded: state(Gtk.AccessibleState.EXPANDED, fromInt),
    accessibleHidden: state(Gtk.AccessibleState.HIDDEN, fromBoolean),
    accessibleInvalid: state(Gtk.AccessibleState.INVALID, fromInt),
    accessiblePressed: state(Gtk.AccessibleState.PRESSED, fromInt),
    accessibleSelected: state(Gtk.AccessibleState.SELECTED, fromInt),
    accessibleVisited: state(Gtk.AccessibleState.VISITED, fromInt),
    accessibleActiveDescendant: relation(Gtk.AccessibleRelation.ACTIVE_DESCENDANT, fromObject),
    accessibleColCount: relation(Gtk.AccessibleRelation.COL_COUNT, fromInt),
    accessibleColIndex: relation(Gtk.AccessibleRelation.COL_INDEX, fromInt),
    accessibleColIndexText: relation(Gtk.AccessibleRelation.COL_INDEX_TEXT, fromString),
    accessibleColSpan: relation(Gtk.AccessibleRelation.COL_SPAN, fromInt),
    accessibleControls: relation(Gtk.AccessibleRelation.CONTROLS, fromRefList),
    accessibleDescribedBy: relation(Gtk.AccessibleRelation.DESCRIBED_BY, fromRefList),
    accessibleDetails: relation(Gtk.AccessibleRelation.DETAILS, fromRefList),
    accessibleErrorMessage: relation(Gtk.AccessibleRelation.ERROR_MESSAGE, fromRefList),
    accessibleFlowTo: relation(Gtk.AccessibleRelation.FLOW_TO, fromRefList),
    accessibleLabelledBy: relation(Gtk.AccessibleRelation.LABELLED_BY, fromRefList),
    accessibleOwns: relation(Gtk.AccessibleRelation.OWNS, fromRefList),
    accessiblePosInSet: relation(Gtk.AccessibleRelation.POS_IN_SET, fromInt),
    accessibleRowCount: relation(Gtk.AccessibleRelation.ROW_COUNT, fromInt),
    accessibleRowIndex: relation(Gtk.AccessibleRelation.ROW_INDEX, fromInt),
    accessibleRowIndexText: relation(Gtk.AccessibleRelation.ROW_INDEX_TEXT, fromString),
    accessibleRowSpan: relation(Gtk.AccessibleRelation.ROW_SPAN, fromInt),
    accessibleSetSize: relation(Gtk.AccessibleRelation.SET_SIZE, fromInt),
};

const lookupDescriptor = (name: string): AccessibleDescriptor | undefined =>
    Object.hasOwn(ACCESSIBLE_PROP_MAP, name) ? ACCESSIBLE_PROP_MAP[name as keyof AccessibleProps] : undefined;

export const isAccessibleProp = (name: string): boolean => Object.hasOwn(ACCESSIBLE_PROP_MAP, name);

function applyDescriptor(widget: Gtk.Accessible, descriptor: AccessibleDescriptor, newValue: unknown): void {
    const gvalue = descriptor.createValue(newValue);

    switch (descriptor.kind) {
        case "property":
            widget.updateProperty([descriptor.enumValue], [gvalue]);
            break;
        case "state":
            widget.updateState([descriptor.enumValue], [gvalue]);
            break;
        case "relation":
            widget.updateRelation([descriptor.enumValue], [gvalue]);
            break;
    }
}

function resetDescriptor(widget: Gtk.Accessible, descriptor: AccessibleDescriptor): void {
    switch (descriptor.kind) {
        case "property":
            widget.resetProperty(descriptor.enumValue);
            break;
        case "state":
            widget.resetState(descriptor.enumValue);
            break;
        case "relation":
            widget.resetRelation(descriptor.enumValue);
            break;
    }
}

const applyChangedAccessibleProps = (
    widget: Gtk.Accessible,
    oldProps: Props | null,
    newProps: Props,
    seen: Set<string>,
): void => {
    for (const name in newProps) {
        const descriptor = lookupDescriptor(name);
        if (!descriptor) continue;
        seen.add(name);

        const newValue = newProps[name];
        if (oldProps?.[name] === newValue) continue;

        if (newValue === undefined) {
            resetDescriptor(widget, descriptor);
            deleteAccessibleMetadata(widget, name);
        } else {
            applyDescriptor(widget, descriptor, newValue);
            setAccessibleMetadata(widget, name, newValue);
        }
    }
};

const resetRemovedAccessibleProps = (widget: Gtk.Accessible, oldProps: Props, seen: Set<string>): void => {
    for (const name in oldProps) {
        if (seen.has(name)) continue;
        const descriptor = lookupDescriptor(name);
        if (!descriptor) continue;
        if (oldProps[name] !== undefined) {
            resetDescriptor(widget, descriptor);
            deleteAccessibleMetadata(widget, name);
        }
    }
};

export const applyAccessibleProps = (widget: Gtk.Accessible, oldProps: Props | null, newProps: Props): void => {
    const seen = new Set<string>();
    applyChangedAccessibleProps(widget, oldProps, newProps, seen);
    if (oldProps) resetRemovedAccessibleProps(widget, oldProps, seen);
};
