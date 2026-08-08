import type { ParseContext, TypeId } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { attr, getChild, getChildren, intAttr, isAttrTrue, type RawNode } from "./parse.js";
import { typeRefFromNode } from "./type-ref.js";

/**
 * One slot in a record or union layout: a named field, or a nested struct or union
 * whose own members are laid out inline.
 */
type GirField = {
    /** Field name as GIR spells it. */
    name: string;
    /** Documentation prose from GIR, emitted as the field accessor's JSDoc. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the field. */
    annotations: GirAnnotations;
    /** The field's value type, absent for a nested struct or union and for one GIR leaves undeclared. */
    type: TypeId | undefined;
    /** The C type spelled on the field, which decides whether it is read through a pointer. */
    cType: string | undefined;
    /** Whether the field can be read; one that is neither readable nor writable gets no accessor at all. */
    readable: boolean;
    /** Whether the field can be written, which is what earns it a setter alongside its getter. */
    writable: boolean;
    /** Whether the field is private to the library, as every nested struct or union is. */
    private: boolean;
    /** Width in bits when the field is a C bitfield member. */
    bits: number | undefined;
    /** Members of a nested struct or union, absent for a named field. */
    inlineMembers: GirField[] | undefined;
    /** Whether {@link GirField.inlineMembers} overlap as a union rather than following one another as a struct. */
    isInlineUnion: boolean;
};

const fieldFromNode = (node: RawNode, context: ParseContext): GirField => ({
    ...documentedFromNode(node),
    type: typeRefFromNode(node, context),
    cType: attr(getChild(node, "type"), "c:type"),
    readable: isAttrTrue(node, "readable", true),
    writable: isAttrTrue(node, "writable", false),
    private: isAttrTrue(node, "private", false),
    bits: intAttr(node, "bits"),
    inlineMembers: undefined,
    isInlineUnion: false,
});

const anonymousMemberFromNode = (node: RawNode, isUnion: boolean, context: ParseContext): GirField => ({
    ...documentedFromNode(node),
    type: undefined,
    cType: undefined,
    readable: false,
    writable: false,
    private: true,
    bits: undefined,
    inlineMembers: collectFields(node, context),
    isInlineUnion: isUnion,
});

const collectFields = (node: RawNode, context: ParseContext): GirField[] => [
    ...getChildren(node, "field").map((field) => fieldFromNode(field, context)),
    ...getChildren(node, "union").map((member) => anonymousMemberFromNode(member, true, context)),
    ...getChildren(node, "record").map((member) => anonymousMemberFromNode(member, false, context)),
];

export { collectFields, type GirField };
