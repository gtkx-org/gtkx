import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { attr, getChildren, isAttrTrue, type RawNode } from "./parse.js";

/** One member of a {@link GirEnum}. */
type EnumMember = {
    /** The member's GIR name, which the emitted key is derived from. */
    name: string;
    /** Documentation prose from GIR, emitted as the member's JSDoc. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the member. */
    annotations: GirAnnotations;
    /** The member's numeric value, `0` when GIR declares none. */
    value: string;
    /** C constant the member is exposed as, such as `GTK_ORIENTATION_HORIZONTAL`. */
    cIdentifier: string | undefined;
};

/** Whether an enum is a plain enumeration or a bitfield of flags. */
type EnumKind = "enumeration" | "bitfield";

/** An enumeration or bitfield declared by a GIR namespace. */
type GirEnum = {
    /** Whether the declaration is a plain enumeration or a bitfield. */
    kind: EnumKind;
    /** Name the enum is exported under, without its namespace prefix. */
    name: string;
    /** Documentation prose from GIR, emitted as the enum's JSDoc. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the enum. */
    annotations: GirAnnotations;
    /** GType name of the enum, absent when it is not registered with GLib. */
    glibTypeName: string | undefined;
    /** C function returning the enum's GType, absent when it is not registered with GLib. */
    glibGetType: string | undefined;
    /** Quark name of the GError domain the members are codes of, absent on enums that carry no domain. */
    errorDomain: string | undefined;
    /** Whether the enum is introspectable; code generation skips the ones that are not. */
    introspectable: boolean;
    /** The enum's members, in declaration order. */
    members: EnumMember[];
};

const enumMemberFromNode = (node: RawNode): EnumMember => ({
    ...documentedFromNode(node),
    value: attr(node, "value") ?? "0",
    cIdentifier: attr(node, "c:identifier"),
});

const enumFromNode = (node: RawNode, kind: EnumKind): GirEnum => ({
    kind,
    ...documentedFromNode(node),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    errorDomain: attr(node, "glib:error-domain"),
    introspectable: isAttrTrue(node, "introspectable", true),
    members: getChildren(node, "member").map((member) => enumMemberFromNode(member)),
});

export { enumFromNode, type EnumMember, type GirEnum };
