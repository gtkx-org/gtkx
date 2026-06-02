import { fieldFromNode, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, attrBool, childrenOf, GIR_CONSTRUCTOR_TAG, type RawNode } from "./parse.js";

/**
 * Discriminator for the different shapes a `<record>` (or `<glib:boxed>`)
 * can take in GIR.
 *
 * - `boxed` — a record with a `glib:get-type`; registers as a GObject boxed.
 * - `plain-struct` — a record without GType; passed by pointer using
 *   `t.struct(ownership)`.
 * - `vtable` — a record carrying `glib:is-gtype-struct-for`; its fields are
 *   function pointers consumed by the class struct registration.
 * - `glib-boxed` — a top-level `<glib:boxed>` element with no struct body.
 */
export type BoxedKind = "boxed" | "plain-struct" | "vtable" | "glib-boxed";

/** A `<record>`, `<glib:boxed>`, or `<union>` declaration. */
export type GirBoxed = {
    readonly kind: BoxedKind;
    /** Local name inside the namespace (no prefix). */
    readonly name: string;
    readonly cType: string | undefined;
    /** GLib type name (e.g. `"GtkBorder"`); absent on plain structs. */
    readonly glibTypeName: string | undefined;
    /** GLib get-type C symbol; absent on plain structs. */
    readonly glibGetType: string | undefined;
    /** Class name this record is the vtable for (`glib:is-gtype-struct-for`). */
    readonly glibIsGTypeStructFor: string | undefined;
    /** GLib ref/unref/etc. function names on fundamentals. */
    readonly glibRefFunc: string | undefined;
    readonly glibUnrefFunc: string | undefined;
    readonly glibSetValueFunc: string | undefined;
    readonly glibGetValueFunc: string | undefined;
    /** `copy-function`/`free-function` — the ref/unref pair for records that are reference-counted rather than g_boxed-copyable. */
    readonly copyFunc: string | undefined;
    readonly freeFunc: string | undefined;
    /** `disguised="1"` — record has no introspectable fields. */
    readonly disguised: boolean;
    /** `opaque="1"` — record is opaque to callers. */
    readonly opaque: boolean;
    readonly introspectable: boolean;
    readonly fields: readonly GirField[];
    readonly methods: readonly GirFunction[];
    readonly constructors: readonly GirFunction[];
    readonly functions: readonly GirFunction[];
    /** `true` when the source element was `<union>` rather than `<record>`. */
    readonly isUnion: boolean;
};

/**
 * Builds a {@link GirBoxed} from a `<record>`, `<union>`, or `<glib:boxed>` element.
 *
 * @param node - The XML element
 * @param kind - The kind inferred from element name and attribute set
 * @param isUnion - `true` when the source element was `<union>`
 */
export const boxedFromNode = (node: RawNode, kind: BoxedKind, isUnion: boolean): GirBoxed => ({
    kind,
    name: attr(node, "name") ?? attr(node, "glib:name") ?? "",
    cType: attr(node, "c:type"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    glibIsGTypeStructFor: attr(node, "glib:is-gtype-struct-for"),
    glibRefFunc: attr(node, "glib:ref-func"),
    glibUnrefFunc: attr(node, "glib:unref-func"),
    glibSetValueFunc: attr(node, "glib:set-value-func"),
    glibGetValueFunc: attr(node, "glib:get-value-func"),
    copyFunc: attr(node, "copy-function"),
    freeFunc: attr(node, "free-function"),
    disguised: attrBool(node, "disguised"),
    opaque: attrBool(node, "opaque"),
    introspectable: attr(node, "introspectable") !== "0",
    fields: childrenOf(node, "field").map(fieldFromNode),
    methods: childrenOf(node, "method").map((method) => functionFromNode(method, "method")),
    constructors: childrenOf(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, "constructor")),
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, "function")),
    isUnion,
});

/**
 * Decides which {@link BoxedKind} applies to a `<record>` or `<union>` element.
 *
 * Vtable records (`glib:is-gtype-struct-for`) take precedence; otherwise a
 * `glib:get-type` flips the record to a registered boxed; otherwise it's a
 * plain struct.
 *
 * @param node - The `<record>` or `<union>` element
 */
export const boxedKind = (node: RawNode): BoxedKind => {
    if (attr(node, "glib:is-gtype-struct-for") !== undefined) return "vtable";
    if (attr(node, "glib:get-type") !== undefined) return "boxed";
    return "plain-struct";
};
