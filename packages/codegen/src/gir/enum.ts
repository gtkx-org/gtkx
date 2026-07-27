import { attr, getChildren, getDoc, isAttrTrue, nameAttr, type RawNode } from "./parse.js";

type EnumMember = {
    name: string;
    doc: string | undefined;
    value: string;
    cIdentifier: string | undefined;
};

type EnumKind = "enumeration" | "bitfield";

type GirEnum = {
    kind: EnumKind;
    name: string;
    doc: string | undefined;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
    errorDomain: string | undefined;
    introspectable: boolean;
    members: EnumMember[];
};

const enumFromNode = (node: RawNode, kind: EnumKind): GirEnum => ({
    kind,
    name: nameAttr(node),
    doc: getDoc(node),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    errorDomain: attr(node, "glib:error-domain"),
    introspectable: isAttrTrue(node, "introspectable", true),
    members: getChildren(node, "member").map((member) => ({
        name: nameAttr(member),
        doc: getDoc(member),
        value: attr(member, "value") ?? "0",
        cIdentifier: attr(member, "c:identifier"),
    })),
});

export { enumFromNode, type GirEnum };
