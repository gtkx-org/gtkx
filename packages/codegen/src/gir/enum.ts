import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { attr, getChildren, isAttrTrue, type RawNode } from "./parse.js";

type EnumMember = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    value: string;
    cIdentifier: string | undefined;
};

type EnumKind = "enumeration" | "bitfield";

type GirEnum = {
    kind: EnumKind;
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
    errorDomain: string | undefined;
    introspectable: boolean;
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
