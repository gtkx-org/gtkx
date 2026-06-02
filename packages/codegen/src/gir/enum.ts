import { functionFromNode, type GirFunction } from "./function.js";
import { attr, childrenOf, type RawNode } from "./parse.js";

/** A single `<member>` of an `<enumeration>` or `<bitfield>`. */
type EnumMember = {
    /** GIR `name`, snake_case lowercase (e.g. `"fill"`). */
    readonly name: string;
    /** GIR `c:identifier`, SCREAMING_SNAKE_CASE (e.g. `"GTK_ALIGN_FILL"`). */
    readonly cIdentifier: string | undefined;
    /** Numeric value as a string; preserved verbatim from GIR. */
    readonly value: string;
};

/** Discriminator for enums vs bitfields. */
export type EnumKind = "enumeration" | "bitfield";

/** An `<enumeration>` or `<bitfield>` declaration. */
export type GirEnum = {
    readonly kind: EnumKind;
    /** Local name within the namespace (no namespace prefix). */
    readonly name: string;
    readonly cType: string | undefined;
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
 */
export const enumFromNode = (node: RawNode, kind: EnumKind): GirEnum => ({
    kind,
    name: attr(node, "name") ?? "",
    cType: attr(node, "c:type"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    errorDomain: attr(node, "glib:error-domain"),
    introspectable: attr(node, "introspectable") !== "0",
    members: childrenOf(node, "member").map((member) => ({
        name: attr(member, "name") ?? "",
        cIdentifier: attr(member, "c:identifier"),
        value: attr(member, "value") ?? "0",
    })),
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, "function")),
});
