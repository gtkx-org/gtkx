import type * as GObject from "@gtkx/ffi/gobject";
import { Value } from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../../types.js";

type CreateValue = (jsValue: unknown) => Value;

type PropertyDef = {
    kind: "property";
    enumValue: Gtk.AccessibleProperty;
    createValue: CreateValue;
};

type StateDef = {
    kind: "state";
    enumValue: Gtk.AccessibleState;
    createValue: CreateValue;
};

type RelationDef = {
    kind: "relation";
    enumValue: Gtk.AccessibleRelation;
    createValue: CreateValue;
};

type AccessiblePropDef = PropertyDef | StateDef | RelationDef;

const fromString: CreateValue = (val) => Value.newFromString(val as string);
const fromBoolean: CreateValue = (val) => Value.newFromBoolean(val as boolean);
const fromInt: CreateValue = (val) => Value.newFromInt(val as number);
const fromDouble: CreateValue = (val) => Value.newFromDouble(val as number);
const fromObject: CreateValue = (val) => Value.newFromObject((val as GObject.Object) ?? null);

const fromRefList: CreateValue = (val) => {
    const widgets = val as Gtk.Accessible[];
    const list = Gtk.AccessibleList.newFromList(widgets);
    return Value.newFromBoxed(list);
};

const prop = (enumValue: Gtk.AccessibleProperty, createValue: CreateValue): PropertyDef => ({
    kind: "property",
    enumValue,
    createValue,
});

const state = (enumValue: Gtk.AccessibleState, createValue: CreateValue): StateDef => ({
    kind: "state",
    enumValue,
    createValue,
});

const relation = (enumValue: Gtk.AccessibleRelation, createValue: CreateValue): RelationDef => ({
    kind: "relation",
    enumValue,
    createValue,
});

const ACCESSIBLE_PROP_MAP: Record<string, AccessiblePropDef> = {
    accessibleAutocomplete: prop(Gtk.AccessibleProperty.AUTOCOMPLETE, fromInt),
    accessibleDescription: prop(Gtk.AccessibleProperty.DESCRIPTION, fromString),
    accessibleHasPopup: prop(Gtk.AccessibleProperty.HAS_POPUP, fromBoolean),
    accessibleKeyShortcuts: prop(Gtk.AccessibleProperty.KEY_SHORTCUTS, fromString),
    accessibleLabel: prop(Gtk.AccessibleProperty.LABEL, fromString),
    accessibleLevel: prop(Gtk.AccessibleProperty.LEVEL, fromInt),
    accessibleModal: prop(Gtk.AccessibleProperty.MODAL, fromBoolean),
    accessibleMultiLine: prop(Gtk.AccessibleProperty.MULTI_LINE, fromBoolean),
    accessibleMultiSelectable: prop(Gtk.AccessibleProperty.MULTI_SELECTABLE, fromBoolean),
    accessibleOrientation: prop(Gtk.AccessibleProperty.ORIENTATION, fromInt),
    accessiblePlaceholder: prop(Gtk.AccessibleProperty.PLACEHOLDER, fromString),
    accessibleReadOnly: prop(Gtk.AccessibleProperty.READ_ONLY, fromBoolean),
    accessibleRequired: prop(Gtk.AccessibleProperty.REQUIRED, fromBoolean),
    accessibleRoleDescription: prop(Gtk.AccessibleProperty.ROLE_DESCRIPTION, fromString),
    accessibleSort: prop(Gtk.AccessibleProperty.SORT, fromInt),
    accessibleValueMax: prop(Gtk.AccessibleProperty.VALUE_MAX, fromDouble),
    accessibleValueMin: prop(Gtk.AccessibleProperty.VALUE_MIN, fromDouble),
    accessibleValueNow: prop(Gtk.AccessibleProperty.VALUE_NOW, fromDouble),
    accessibleValueText: prop(Gtk.AccessibleProperty.VALUE_TEXT, fromString),
    accessibleHelpText: prop(Gtk.AccessibleProperty.HELP_TEXT, fromString),

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

function applyDef(widget: Gtk.Widget, def: AccessiblePropDef, newValue: unknown): void {
    const gvalue = def.createValue(newValue);

    switch (def.kind) {
        case "property":
            widget.updatePropertyValue([def.enumValue], [gvalue]);
            break;
        case "state":
            widget.updateStateValue([def.enumValue], [gvalue]);
            break;
        case "relation":
            widget.updateRelationValue([def.enumValue], [gvalue]);
            break;
    }
}

function resetDef(widget: Gtk.Widget, def: AccessiblePropDef): void {
    switch (def.kind) {
        case "property":
            widget.resetProperty(def.enumValue);
            break;
        case "state":
            widget.resetState(def.enumValue);
            break;
        case "relation":
            widget.resetRelation(def.enumValue);
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
        const def = ACCESSIBLE_PROP_MAP[name];
        if (!def) continue;
        seen.add(name);

        const newValue = newProps[name];
        if (oldProps?.[name] === newValue) continue;

        if (newValue === undefined) {
            resetDef(widget, def);
        } else {
            applyDef(widget, def, newValue);
        }
    }
};

const resetRemovedAccessibleProps = (widget: Gtk.Widget, oldProps: Props, seen: Set<string>): void => {
    for (const name in oldProps) {
        if (seen.has(name)) continue;
        const def = ACCESSIBLE_PROP_MAP[name];
        if (!def) continue;
        if (oldProps[name] !== undefined) {
            resetDef(widget, def);
        }
    }
};

export const applyAccessibleProps = (widget: Gtk.Widget, oldProps: Props | null, newProps: Props): void => {
    const seen = new Set<string>();
    applyChangedAccessibleProps(widget, oldProps, newProps, seen);
    if (oldProps) resetRemovedAccessibleProps(widget, oldProps, seen);
};
