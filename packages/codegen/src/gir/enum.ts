import { attr, attrBool, childrenOf, nameAttr, type RawNode } from "./parse.js";

type EnumMember = {
    name: string;
    value: string;
    cIdentifier: string | undefined;
};

type EnumKind = "enumeration" | "bitfield";

export type GirEnum = {
    kind: EnumKind;
    name: string;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
    errorDomain: string | undefined;
    introspectable: boolean;
    members: EnumMember[];
};

export const enumFromNode = (node: RawNode, kind: EnumKind): GirEnum => ({
    kind,
    name: nameAttr(node),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    errorDomain: attr(node, "glib:error-domain"),
    introspectable: attrBool(node, "introspectable", true),
    members: childrenOf(node, "member").map((member) => ({
        name: nameAttr(member),
        value: attr(member, "value") ?? "0",
        cIdentifier: attr(member, "c:identifier"),
    })),
});
