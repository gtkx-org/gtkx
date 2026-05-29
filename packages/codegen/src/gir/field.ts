import { attr, attrBool, childOf, type RawNode } from "./parse.js";
import { type GirTypeRef, typeRefFromSlot } from "./type-ref.js";

/**
 * A `<field>` inside a class, interface, record, or union.
 *
 * Vtable slots (fields holding `<callback>` children inside a
 * `glib:is-gtype-struct-for` record) keep `callback` populated; ordinary
 * data fields keep `type`. The two are mutually exclusive.
 */
export type GirField = {
    /** GIR field name, snake_case. */
    readonly name: string;
    /** Field type, or `undefined` when the field is a vtable callback slot. */
    readonly type: GirTypeRef | undefined;
    /** Inline callback for vtable slots; `undefined` for data fields. */
    readonly callback: RawNode | undefined;
    readonly readable: boolean;
    readonly writable: boolean;
    readonly private: boolean;
    /** GIR `bits` attribute width when the field is a bitfield member. */
    readonly bits: number | undefined;
};

/**
 * Builds a {@link GirField} from a `<field>` element.
 */
export const fieldFromNode = (node: RawNode): GirField => {
    const callback = childOf(node, "callback");
    const bitsAttr = attr(node, "bits");
    return {
        name: attr(node, "name") ?? "",
        type: callback === undefined ? typeRefFromSlot(node) : undefined,
        callback,
        readable: attrBool(node, "readable", true),
        writable: attrBool(node, "writable", false),
        private: attrBool(node, "private", false),
        bits: bitsAttr === undefined ? undefined : Number.parseInt(bitsAttr, 10),
    };
};
