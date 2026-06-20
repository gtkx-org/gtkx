import { functionFromNode, type GirFunction } from "./function.js";
import { attr, attrBool, childrenOf, nameAttr, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

/** A single `<member>` of an `<enumeration>` or `<bitfield>`. */
type EnumMember = {
    /** GIR `name`, snake_case lowercase (e.g. `"fill"`). */
    readonly name: string;
    /** Numeric value as a string; preserved verbatim from GIR. */
    readonly value: string;
    /** C constant name (e.g. `"GTK_ALIGN_FILL"`), as a property's `default-value` references it. */
    readonly cIdentifier: string | undefined;
};

/** Discriminator for enums vs bitfields. */
type EnumKind = "enumeration" | "bitfield";

/** An `<enumeration>` or `<bitfield>` declaration. */
export type GirEnum = {
    readonly kind: EnumKind;
    /** Local name within the namespace (no namespace prefix). */
    readonly name: string;
    /** GLib type name (e.g. `"GtkAlign"`); absent for unregistered enums. */
    readonly glibTypeName: string | undefined;
    /** GLib get-type C symbol; absent for unregistered enums. */
    readonly glibGetType: string | undefined;
    /** Optional `glib:error-domain` marker; presence flips emission to `createErrorDomain`. */
    readonly errorDomain: string | undefined;
    readonly introspectable: boolean;
    readonly members: readonly EnumMember[];
    /** Free functions nested inside the enum (e.g. error quark accessors). */
    readonly functions: readonly GirFunction[];
};

/**
 * Builds a {@link GirEnum} from an `<enumeration>` or `<bitfield>` element.
 *
 * @param node - The XML element
 * @param kind - `"enumeration"` or `"bitfield"`, matching the element name
 * @param context - The per-namespace interning seam
 */
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
