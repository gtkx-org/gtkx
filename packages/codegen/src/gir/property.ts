import type { ParameterTransfer } from "./parameter.js";
import { attr, attrBool, type RawNode } from "./parse.js";
import { type GirTypeRef, typeRefFromSlot } from "./type-ref.js";

/**
 * A `<property>` of a class or interface.
 *
 * GIR property names are kebab-case; the writers convert them to camelCase
 * for the JS surface and emit the original GIR name as the GValue-record
 * key that typed per-class constructors pass to
 * `g_object_new_with_properties` (see `constructor-props.ts`).
 */
export type GirProperty = {
    /** GIR property name, kebab-case (e.g. `"css-name"`). */
    readonly name: string;
    /** Property value type. */
    readonly type: GirTypeRef | undefined;
    readonly writable: boolean;
    readonly construct: boolean;
    readonly constructOnly: boolean;
    /**
     * Whether the property is exposed to introspection. A property marked
     * `introspectable="0"` (e.g. one typed against a private C type) carries no
     * usable value type and cannot be marshalled, so generators omit it.
     */
    readonly introspectable: boolean;
    readonly transferOwnership: ParameterTransfer;
    /** Optional method name that backs the property's getter (`getter="get_foo"`). */
    readonly getter: string | undefined;
    /** Optional method name that backs the property's setter (`setter="set_foo"`). */
    readonly setter: string | undefined;
    /**
     * GIR `default-value`, verbatim — a `GParamSpec` default rendered as a
     * string (`"TRUE"`, `"0"`, `"NULL"`, an enum `c:identifier`, a literal). Absent
     * when the GIR omits it.
     */
    readonly defaultValue: string | undefined;
};

/**
 * Builds a {@link GirProperty} from a `<property>` element.
 */
export const propertyFromNode = (node: RawNode): GirProperty => ({
    name: attr(node, "name") ?? "",
    type: typeRefFromSlot(node),
    writable: attrBool(node, "writable"),
    construct: attrBool(node, "construct"),
    constructOnly: attrBool(node, "construct-only"),
    introspectable: attrBool(node, "introspectable", true),
    transferOwnership: (attr(node, "transfer-ownership") ?? "none") as ParameterTransfer,
    getter: attr(node, "getter"),
    setter: attr(node, "setter"),
    defaultValue: attr(node, "default-value"),
});
