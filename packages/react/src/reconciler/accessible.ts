import { ACCESSIBLE_ATTRIBUTES } from "virtual:gtkx-config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { deleteAccessibleMetadata, setAccessibleMetadata } from "../utils/accessible-metadata.js";
import type { Props } from "./types.js";

type AccessibleAttributeValue = "string" | "boolean" | "int" | "double" | "object" | "ref-list";

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
    GObject.buildValue(GObject.TYPE_OBJECT, (v) => v.setObject((val as GObject.Object) ?? null));

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

const COERCION_BY_VALUE: Record<AccessibleAttributeValue, CreateValue> = {
    string: fromString,
    boolean: fromBoolean,
    int: fromInt,
    double: fromDouble,
    object: fromObject,
    "ref-list": fromRefList,
};

const ENUM_BY_KIND = {
    property: Gtk.AccessibleProperty,
    state: Gtk.AccessibleState,
    relation: Gtk.AccessibleRelation,
};

const toDescriptor = (attribute: {
    kind: "property" | "state" | "relation";
    member: string;
    value: AccessibleAttributeValue;
}): AccessibleDescriptor => {
    const createValue = COERCION_BY_VALUE[attribute.value];
    const { kind, member } = attribute;
    switch (kind) {
        case "property":
            return property(ENUM_BY_KIND[kind][member as keyof typeof Gtk.AccessibleProperty], createValue);
        case "state":
            return state(ENUM_BY_KIND[kind][member as keyof typeof Gtk.AccessibleState], createValue);
        case "relation":
            return relation(ENUM_BY_KIND[kind][member as keyof typeof Gtk.AccessibleRelation], createValue);
    }
};

const ACCESSIBLE_PROP_MAP: Record<string, AccessibleDescriptor> = {};
for (const [name, attribute] of Object.entries(ACCESSIBLE_ATTRIBUTES)) {
    ACCESSIBLE_PROP_MAP[name] = toDescriptor(attribute);
}

export const isAccessibleProp = (name: string): boolean => name in ACCESSIBLE_PROP_MAP;

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

const resetRemovedAccessibleProps = (widget: Gtk.Accessible, oldProps: Props, seen: Set<string>): void => {
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

export const applyAccessibleProps = (widget: Gtk.Accessible, oldProps: Props | null, newProps: Props): void => {
    const seen = new Set<string>();
    applyChangedAccessibleProps(widget, oldProps, newProps, seen);
    if (oldProps) resetRemovedAccessibleProps(widget, oldProps, seen);
};
