import type { ParseContext, TypeId } from "./type-id.js";
import { annotationsFromNode, type GirAnnotations } from "./annotations.js";
import { type ParameterTransfer, transferOwnership } from "./parameter.js";
import { attr, getDoc, isAttrTrue, nameAttr, type RawNode } from "./parse.js";
import { typeRefFromNode } from "./type-ref.js";

/** A GObject property declared on a class or interface, with the annotations its accessors are generated from. */
type GirProperty = {
    /** Canonical property name, dashed the way GObject registers it. */
    name: string;
    /** Documentation prose from GIR, emitted as the accessor's JSDoc. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the property. */
    annotations: GirAnnotations;
    /** The property's value type, absent when GIR declares none. */
    type: TypeId | undefined;
    /** Whether GObject exposes the value for reading, which admits a generated getter. */
    // eslint-disable-next-line gtkx/boolean-name
    readable: boolean;
    /** Whether GObject accepts a value for the property, which admits a generated setter. */
    // eslint-disable-next-line gtkx/boolean-name
    writable: boolean;
    /** Whether GObject sets the property during construction, using its default when none is supplied. */
    // eslint-disable-next-line gtkx/boolean-name
    construct: boolean;
    /** Whether the property can only be set at construction. */
    // eslint-disable-next-line gtkx/boolean-name
    constructOnly: boolean;
    /** Whether GIR exposes the property to bindings. */
    // eslint-disable-next-line gtkx/boolean-name
    introspectable: boolean;
    /** How ownership of the value transfers, which decides the descriptor the accessors marshal through. */
    transferOwnership: ParameterTransfer;
    /** Method GIR names as reading the property, which the generated getter delegates to. */
    getter: string | undefined;
    /** Method GIR names as writing the property, which the generated setter delegates to. */
    setter: string | undefined;
    /** The property's default, as GIR spells it. */
    defaultValue: string | undefined;
};

const isConstructableProperty = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

const propertyFromNode = (node: RawNode, context: ParseContext): GirProperty => ({
    name: nameAttr(node),
    doc: getDoc(node),
    annotations: annotationsFromNode(node),
    type: typeRefFromNode(node, context),
    readable: isAttrTrue(node, "readable", true),
    writable: isAttrTrue(node, "writable"),
    construct: isAttrTrue(node, "construct"),
    constructOnly: isAttrTrue(node, "construct-only"),
    introspectable: isAttrTrue(node, "introspectable", true),
    transferOwnership: transferOwnership(node),
    getter: attr(node, "getter"),
    setter: attr(node, "setter"),
    defaultValue: attr(node, "default-value"),
});

export { isConstructableProperty, propertyFromNode, type GirProperty };
