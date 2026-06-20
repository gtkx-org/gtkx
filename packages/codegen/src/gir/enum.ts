import { functionFromNode, type GirFunction } from "./function.js";
import { attr, attrBool, childrenOf, nameAttr, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

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
    functions: GirFunction[];
};

export const enumFromNode = (node: RawNode, kind: EnumKind, context: ParseContext): GirEnum => ({
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
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, "function", context)),
});
