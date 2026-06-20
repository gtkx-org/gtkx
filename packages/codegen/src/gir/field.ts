import { attr, attrBool, childOf, intAttr, nameAttr, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromSlot } from "./type-ref.js";

/**
 * A `<field>` inside a class, interface, record, or union.
 *
 * A vtable slot (a `<callback>` child inside a `glib:is-gtype-struct-for`
 * record) interns its type as a callback handle; an ordinary data field interns
 * its `<type>`/`<array>` slot.
 */
export type GirField = {
    /** GIR field name, snake_case. */
    readonly name: string;
    /** Interned field type, or `undefined` when no type slot is present. */
    readonly type: TypeId | undefined;
    /** The field's own `c:type`, kept for the record-layout pointer test. */
    readonly cType: string | undefined;
    readonly readable: boolean;
    readonly writable: boolean;
    readonly private: boolean;
    /** GIR `bits` attribute width when the field is a bitfield member. */
    readonly bits: number | undefined;
};

/**
 * Builds a {@link GirField} from a `<field>` element.
 *
 * @param node - The `<field>` element
 * @param context - The per-namespace interning seam
 */
export const fieldFromNode = (node: RawNode, context: ParseContext): GirField => ({
    name: nameAttr(node),
    type: typeRefFromSlot(node, context),
    cType: attr(childOf(node, "type"), "c:type"),
    readable: attrBool(node, "readable", true),
    writable: attrBool(node, "writable", false),
    private: attrBool(node, "private", false),
    bits: intAttr(node, "bits"),
});
