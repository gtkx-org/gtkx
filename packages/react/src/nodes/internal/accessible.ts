import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { Props } from "../../types.js";
import { deleteAccessibleMetadata, setAccessibleMetadata } from "../../widget-metadata.js";

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

const createGValue = (gtype: GObject.GType, populate: (value: GObject.Value) => void): GObject.Value => {
    const value = new GObject.Value();
    value.init(gtype);
    populate(value);
    return value;
};

const fromString: CreateValue = (val) => createGValue(GObject.TYPE_STRING, (v) => v.setString(val as string));
const fromBoolean: CreateValue = (val) => createGValue(GObject.TYPE_BOOLEAN, (v) => v.setBoolean(val as boolean));
const fromInt: CreateValue = (val) => createGValue(GObject.TYPE_INT, (v) => v.setInt(val as number));
const fromDouble: CreateValue = (val) => createGValue(GObject.TYPE_DOUBLE, (v) => v.setDouble(val as number));
const fromObject: CreateValue = (val) =>
    createGValue(GObject.TYPE_OBJECT, (v) => v.setObject((val as GObject.Object) ?? null));

const fromRefList: CreateValue = (val) => {
    const widgets = val as Gtk.Accessible[];
    const list = Gtk.AccessibleList.newFromList(widgets);
    return createGValue(Gtk.AccessibleList.prototype.__gtype__, (v) => v.setBoxed(list));
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

const ACCESSIBLE_PROP_MAP: Record<string, AccessibleDescriptor> = {
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

export const isAccessibleProp = (name: string): boolean => name in ACCESSIBLE_PROP_MAP;

function applyDescriptor(widget: Gtk.Widget, descriptor: AccessibleDescriptor, newValue: unknown): void {
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

function resetDescriptor(widget: Gtk.Widget, descriptor: AccessibleDescriptor): void {
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
    widget: Gtk.Widget,
    oldProps: Props | null,
    newProps: Props,
    seen: Set<string>,
): void => {
    for (const name in newProps) {
        const descriptor = ACCESSIBLE_PROP_MAP[name];
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

const resetRemovedAccessibleProps = (widget: Gtk.Widget, oldProps: Props, seen: Set<string>): void => {
    for (const name in oldProps) {
        if (seen.has(name)) continue;
        const descriptor = ACCESSIBLE_PROP_MAP[name];
        if (!descriptor) continue;
        if (oldProps[name] !== undefined) {
            resetDescriptor(widget, descriptor);
            deleteAccessibleMetadata(widget, name);
        }
    }
};

export const applyAccessibleProps = (widget: Gtk.Widget, oldProps: Props | null, newProps: Props): void => {
    const seen = new Set<string>();
    applyChangedAccessibleProps(widget, oldProps, newProps, seen);
    if (oldProps) resetRemovedAccessibleProps(widget, oldProps, seen);
};
