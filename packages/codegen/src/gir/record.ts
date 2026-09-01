import type { ParseContext } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { collectFields, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, getChildren, GIR_CONSTRUCTOR_TAG, isAttrTrue, type RawNode } from "./parse.js";

/** A C struct or union declared by a GIR namespace: a plain record, a boxed type, or a GObject vtable. */
type GirRecord = {
    /** Whether the record is the class or interface struct holding another type's virtual methods. */
    isVtable: boolean;
    /** Name within the declaring namespace, such as `"TextIter"`. */
    name: string;
    /** Raw gtk-doc text from the GIR, undefined when the record is undocumented. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the record. */
    annotations: GirAnnotations;
    /** C struct name, such as `"GtkTextIter"`. */
    cType: string | undefined;
    /** GLib type name the record is registered under, present when it is a boxed type. */
    glibTypeName: string | undefined;
    /** Name of the function registering the record's GType, such as `"gtk_text_iter_get_type"`. */
    glibGetType: string | undefined;
    /** Name of the function duplicating an instance, which for a refcounted record takes a reference. */
    copyFunc: string | undefined;
    /** Name of the function releasing an instance, which for a refcounted record drops a reference. */
    freeFunc: string | undefined;
    /** Whether the struct is only ever handled behind a pointer, so its layout stays hidden. */
    disguised: boolean;
    /** Whether the struct's fields are private, so instances cannot be allocated or read directly. */
    opaque: boolean;
    /** Whether the record is exposed to language bindings. */
    introspectable: boolean;
    /** Struct members: the named fields first, then the anonymous inline unions, then the inline records. */
    fields: GirField[];
    /** Functions taking an instance of the record as their first argument. */
    methods: GirFunction[];
    /** Functions returning a new instance of the record. */
    constructors: GirFunction[];
    /** Functions scoped to the record but taking no instance. */
    functions: GirFunction[];
    /** Whether the record is a union, so its fields overlap instead of following one another. */
    isUnion: boolean;
};

const recordFromNode = (
    node: RawNode,
    isVtable: boolean,
    isUnion: boolean,
    context: ParseContext,
): GirRecord => ({
    isVtable,
    ...documentedFromNode(node),
    name: attr(node, "name") ?? attr(node, "glib:name") ?? "",
    cType: attr(node, "c:type"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    copyFunc: attr(node, "copy-function"),
    freeFunc: attr(node, "free-function"),
    disguised: isAttrTrue(node, "disguised"),
    opaque: isAttrTrue(node, "opaque"),
    introspectable: isAttrTrue(node, "introspectable", true),
    fields: collectFields(node, context),
    methods: getChildren(node, "method").map((method) => functionFromNode(method, context)),
    constructors: getChildren(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, context)),
    functions: getChildren(node, "function").map((fn) => functionFromNode(fn, context)),
    isUnion,
});

const isVtableRecord = (node: RawNode): boolean => attr(node, "glib:is-gtype-struct-for") !== undefined;

const INTERN_GTYPE = "intern";

const isInternRecord = (record: GirRecord): boolean => record.glibGetType === INTERN_GTYPE;

const isBoxedRecord = (record: GirRecord): record is GirRecord & { glibGetType: string } =>
    record.glibGetType !== undefined && !isInternRecord(record);

export { recordFromNode, isVtableRecord, isBoxedRecord, isInternRecord, type GirRecord };
