import { quote } from "@gtkx/utils";
import { joinArgs } from "../dsl/emit.js";

/**
 * Ownership transfer encoded into an emitted `t.*` descriptor.
 *
 * Mirrors the `"borrowed" | "full"` union that the `@gtkx/ffi` runtime accepts
 * for descriptor ownership. Defined once here so descriptor builders and their
 * callers share a single source of truth instead of repeating the union.
 */
export type Ownership = "borrowed" | "full";

/**
 * Names of the descriptor helpers exposed by the `@gtkx/ffi` `t.*` namespace.
 *
 * Each key is a member of `t` in `packages/ffi/src/t.ts`; the values are the
 * literal `t.<name>` source fragments emitted into generated `@gtkx/gi` and
 * `@gtkx/jsx` modules. Keying this map to the runtime member names makes the
 * descriptor vocabulary a single compile-time anchor: renaming a member there
 * without updating this map fails to type-check here.
 */
type DescriptorName =
    | "bind"
    | "int8"
    | "uint8"
    | "int16"
    | "uint16"
    | "int32"
    | "uint32"
    | "int64"
    | "uint64"
    | "bigint64"
    | "biguint64"
    | "float32"
    | "float64"
    | "boolean"
    | "void"
    | "unichar"
    | "blob"
    | "string"
    | "object"
    | "boxed"
    | "struct"
    | "fundamental"
    | "ref"
    | "hashTable"
    | "enum"
    | "flags"
    | "array"
    | "list"
    | "slist"
    | "ptrArray"
    | "garray"
    | "byteArray"
    | "sizedArray"
    | "fixedArray"
    | "callback"
    | "fn";

type DescriptorNames = { [K in DescriptorName]: `t.${K}` };

/**
 * Source fragments for every `t.*` helper name.
 *
 * Typed as `DescriptorNames` so the set of keys must match the
 * {@link DescriptorName} union exactly, which itself enumerates the members of
 * the `@gtkx/ffi` `t` object. Builders read fragments from here rather than
 * inlining `"t.foo"` strings, giving the whole codegen surface one anchor for
 * the runtime helper-name contract.
 */
const T: DescriptorNames = {
    bind: "t.bind",
    int8: "t.int8",
    uint8: "t.uint8",
    int16: "t.int16",
    uint16: "t.uint16",
    int32: "t.int32",
    uint32: "t.uint32",
    int64: "t.int64",
    uint64: "t.uint64",
    bigint64: "t.bigint64",
    biguint64: "t.biguint64",
    float32: "t.float32",
    float64: "t.float64",
    boolean: "t.boolean",
    void: "t.void",
    unichar: "t.unichar",
    blob: "t.blob",
    string: "t.string",
    object: "t.object",
    boxed: "t.boxed",
    struct: "t.struct",
    fundamental: "t.fundamental",
    ref: "t.ref",
    hashTable: "t.hashTable",
    enum: "t.enum",
    flags: "t.flags",
    array: "t.array",
    list: "t.list",
    slist: "t.slist",
    ptrArray: "t.ptrArray",
    garray: "t.garray",
    byteArray: "t.byteArray",
    sizedArray: "t.sizedArray",
    fixedArray: "t.fixedArray",
    callback: "t.callback",
    fn: "t.fn",
};

const call = (name: DescriptorName, args: Array<string | undefined>): string => `${T[name]}(${joinArgs(args)})`;

const optionsObject = (parts: Array<string | undefined>): string | undefined => {
    const present = parts.filter((part): part is string => part !== undefined);
    return present.length === 0 ? undefined : `{ ${present.join(", ")} }`;
};

/**
 * The `t.void` descriptor.
 */
export const tVoid: string = T.void;

/**
 * The `t.boolean` descriptor.
 *
 * @public
 */
export const tBoolean: string = T.boolean;

/**
 * The `t.uint8` descriptor.
 *
 * @public
 */
export const tUint8: string = T.uint8;

/**
 * The `t.uint32` descriptor.
 */
export const tUint32: string = T.uint32;

/**
 * The `t.int32` descriptor.
 */
export const tInt32: string = T.int32;

/**
 * The `t.uint64` descriptor used to marshal raw pointers.
 */
export const tUint64: string = T.uint64;

/**
 * The `t.biguint64` descriptor used to marshal `GType` values.
 */
export const tBigUint64: string = T.biguint64;

/**
 * The `t.blob` descriptor for raw byte buffers.
 *
 * @public
 */
export const tBlob: string = T.blob;

/**
 * Names of the argument-less scalar descriptors.
 *
 * These map one-to-one to fixed-width numeric `t.*` helpers and emit as bare
 * `t.<name>` fragments with no call.
 */
export type ScalarDescriptorName =
    | "boolean"
    | "int8"
    | "uint8"
    | "int16"
    | "uint16"
    | "int32"
    | "uint32"
    | "int64"
    | "uint64"
    | "bigint64"
    | "biguint64"
    | "float32"
    | "float64"
    | "unichar";

/**
 * Renders the bare descriptor fragment for an argument-less scalar helper.
 *
 * @param name - The scalar descriptor name.
 * @returns The `t.<name>` source fragment.
 */
export const tScalar = (name: ScalarDescriptorName): string => T[name];

/**
 * Renders a `t.string` descriptor.
 *
 * @param ownership - Ownership transfer of the string.
 * @param length - Optional source expression for a length-bearing string slot.
 * @returns The `t.string(...)` descriptor source.
 */
export const tString = (ownership: Ownership, length?: string): string => call("string", [quote(ownership), length]);

/**
 * Renders a `t.object` descriptor for a GObject instance.
 *
 * @param ownership - Ownership transfer of the object.
 * @param typeName - Optional GLib type name used to resolve an interface wrapper.
 * @returns The `t.object(...)` descriptor source.
 */
export const tObject = (ownership: Ownership, typeName?: string): string =>
    call("object", [quote(ownership), typeName === undefined ? undefined : quote(typeName)]);

/**
 * Options accepted by {@link tBoxed}.
 */
export type BoxedOptions = {
    ownership: Ownership;
    library: string | undefined;
    getTypeFn: string;
    callerAllocated: boolean;
};

/**
 * Renders a `t.boxed` descriptor for a `GType`-registered boxed type.
 *
 * @param glibName - The boxed type's GLib name.
 * @param options - Ownership, optional shared library, `get_type` symbol, and
 *   caller-allocation flag.
 * @returns The `t.boxed(...)` descriptor source.
 */
export const tBoxed = (glibName: string, options: BoxedOptions): string =>
    call("boxed", [
        quote(glibName),
        optionsObject([
            `ownership: ${quote(options.ownership)}`,
            options.library === undefined ? undefined : `library: ${quote(options.library)}`,
            `getTypeFn: ${quote(options.getTypeFn)}`,
            options.callerAllocated ? "callerAllocated: true" : undefined,
        ]),
    ]);

/**
 * Options accepted by {@link tStruct}.
 *
 * `size` is emitted verbatim, so it may be either a numeric byte size or a
 * source expression that evaluates to one.
 */
export type StructOptions = {
    size: number | string | undefined;
    wrapperClass: string | undefined;
    callerAllocated: boolean;
};

/**
 * Renders a `t.struct` descriptor for an inline (non-`GType`) boxed type.
 *
 * @param ownership - Ownership transfer of the struct.
 * @param options - Optional inline size, wrapper class expression, and
 *   caller-allocation flag.
 * @returns The `t.struct(...)` descriptor source.
 */
export const tStruct = (ownership: Ownership, options: StructOptions): string =>
    call("struct", [
        quote(ownership),
        optionsObject([
            options.size === undefined ? undefined : `size: ${options.size}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
            options.callerAllocated ? "callerAllocated: true" : undefined,
        ]),
    ]);

/**
 * Renders a borrowed `t.struct` descriptor with no options.
 *
 * Used for opaque inline pointers (such as `GLsync` and OpenGL pointer types)
 * that carry no inline size or wrapper class.
 *
 * @returns The `t.struct("borrowed")` descriptor source.
 * @public
 */
export const tInlineStruct = (): string =>
    tStruct("borrowed", { size: undefined, wrapperClass: undefined, callerAllocated: false });

/**
 * Options accepted by {@link tFundamental}.
 */
export type FundamentalOptions = {
    ownership: Ownership;
    typeName: string | undefined;
    wrapperClass: string | undefined;
};

/**
 * Renders a `t.fundamental` descriptor for a reference-counted fundamental type.
 *
 * @param lib - Shared library exporting the ref/unref functions.
 * @param refFunc - The reference-adding function name.
 * @param unrefFunc - The reference-dropping function name.
 * @param options - Ownership plus optional GLib type name and wrapper class.
 * @returns The `t.fundamental(...)` descriptor source.
 */
export const tFundamental = (lib: string, refFunc: string, unrefFunc: string, options: FundamentalOptions): string =>
    call("fundamental", [
        quote(lib),
        quote(refFunc),
        quote(unrefFunc),
        optionsObject([
            `ownership: ${quote(options.ownership)}`,
            options.typeName === undefined ? undefined : `typeName: ${quote(options.typeName)}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
        ]),
    ]);

/**
 * Renders a `t.ref` descriptor wrapping an inner descriptor.
 *
 * @param inner - The wrapped descriptor source.
 * @param inout - Whether the cell is read back as an inout slot.
 * @returns The `t.ref(...)` descriptor source.
 */
export const tRef = (inner: string, inout = false): string => call("ref", [inner, inout ? "true" : undefined]);

/**
 * Renders a `t.hashTable` descriptor.
 *
 * @param key - Descriptor source for the key type.
 * @param value - Descriptor source for the value type.
 * @param ownership - Ownership transfer of the table.
 * @returns The `t.hashTable(...)` descriptor source.
 */
export const tHashTable = (key: string, value: string, ownership: Ownership): string =>
    call("hashTable", [key, value, quote(ownership)]);

/**
 * Renders a `t.enum` descriptor for a `GType`-registered enumeration.
 *
 * @param lib - Shared library exporting the `get_type` function.
 * @param getType - The `get_type` symbol name.
 * @param signed - Whether the underlying integer is signed.
 * @returns The `t.enum(...)` descriptor source.
 */
export const tEnum = (lib: string, getType: string, signed: boolean): string =>
    call("enum", [quote(lib), quote(getType), String(signed)]);

/**
 * Renders a `t.flags` descriptor for a `GType`-registered bitfield.
 *
 * @param lib - Shared library exporting the `get_type` function.
 * @param getType - The `get_type` symbol name.
 * @param signed - Whether the underlying integer is signed.
 * @returns The `t.flags(...)` descriptor source.
 */
export const tFlags = (lib: string, getType: string, signed: boolean): string =>
    call("flags", [quote(lib), quote(getType), String(signed)]);

/**
 * Renders a `t.byteArray` descriptor.
 *
 * @param ownership - Ownership transfer of the byte array.
 * @returns The `t.byteArray(...)` descriptor source.
 */
export const tByteArray = (ownership: Ownership): string => call("byteArray", [quote(ownership)]);

/**
 * GLib linked-list flavors backed by a dedicated descriptor helper.
 */
export type ListDescriptorName = "list" | "slist" | "ptrArray" | "garray";

/**
 * Renders a linked-list descriptor (`t.list`, `t.slist`, `t.ptrArray`, or
 * `t.garray`) for the given element.
 *
 * @param name - Which list helper to emit.
 * @param element - Descriptor source for the element type.
 * @param ownership - Ownership transfer of the container.
 * @returns The list descriptor source.
 */
export const tList = (name: ListDescriptorName, element: string, ownership: Ownership): string =>
    call(name, [element, quote(ownership)]);

/**
 * Renders a `t.array` descriptor.
 *
 * @param element - Descriptor source for the element type.
 * @param kind - Optional array kind discriminator.
 * @param ownership - Optional ownership transfer of the array.
 * @param elementSize - Optional inline element byte size.
 * @returns The `t.array(...)` descriptor source.
 */
export const tArray = (element: string, kind?: string, ownership?: Ownership, elementSize?: number): string =>
    call("array", [
        element,
        kind === undefined ? undefined : quote(kind),
        ownership === undefined ? undefined : quote(ownership),
        elementSize === undefined ? undefined : `{ elementSize: ${elementSize} }`,
    ]);

/**
 * Renders a `t.sizedArray` descriptor whose length is read from another slot.
 *
 * @param element - Descriptor source for the element type.
 * @param lengthIndex - Slot index carrying the element count.
 * @param ownership - Optional ownership transfer of the array.
 * @param elementSize - Optional inline element byte size.
 * @returns The `t.sizedArray(...)` descriptor source.
 */
export const tSizedArray = (
    element: string,
    lengthIndex: number,
    ownership?: Ownership,
    elementSize?: number,
): string =>
    call("sizedArray", [
        element,
        String(lengthIndex),
        ownership === undefined ? undefined : quote(ownership),
        elementSize === undefined ? undefined : String(elementSize),
    ]);

/**
 * Renders a `t.fixedArray` descriptor with a compile-time length.
 *
 * @param element - Descriptor source for the element type.
 * @param length - Fixed element count.
 * @param ownership - Optional ownership transfer of the array.
 * @param elementSize - Optional inline element byte size.
 * @returns The `t.fixedArray(...)` descriptor source.
 */
export const tFixedArray = (element: string, length: number, ownership?: Ownership, elementSize?: number): string =>
    call("fixedArray", [
        element,
        String(length),
        ownership === undefined ? undefined : quote(ownership),
        elementSize === undefined ? undefined : String(elementSize),
    ]);

/**
 * Renders a `t.callback` descriptor.
 *
 * @param argTypes - Descriptor sources for each callback argument.
 * @param returnType - Descriptor source for the callback return.
 * @param options - Optional already-rendered callback options object source.
 * @returns The `t.callback(...)` descriptor source.
 */
export const tCallback = (argTypes: string[], returnType: string, options?: string): string =>
    call("callback", [`[${argTypes.join(", ")}]`, returnType, options]);

/**
 * Arguments for a {@link tBind} call expressed as already-rendered source
 * fragments.
 *
 * `libExpr` and `symbolExpr` are emitted verbatim so callers may pass either a
 * quoted string literal or a bare identifier (such as the GL `LIB` constant).
 * `argList` is the rendered argument-descriptor list literal.
 */
export type BindArgs = {
    libExpr: string;
    symbolExpr: string;
    argList: string;
    returnType: string;
};

/**
 * Renders a `t.bind` descriptor for a foreign function binding.
 *
 * @param args - Already-rendered library, symbol, argument-list, and return
 *   descriptor fragments.
 * @returns The `t.bind(...)` descriptor source.
 */
export const tBind = (args: BindArgs): string =>
    call("bind", [args.libExpr, args.symbolExpr, args.argList, args.returnType]);

/**
 * Renders a `t.fn` descriptor for an introspected namespace function.
 *
 * @param lib - Shared library exporting the function.
 * @param cIdentifier - The C symbol name.
 * @param spec - The argument-array source, return descriptor source, and whether
 *   the function reports errors through a trailing `GError` out-parameter.
 * @returns The `t.fn(...)` descriptor source.
 */
export const tFn = (
    lib: string,
    cIdentifier: string,
    spec: { args: string; returns: string; throws: boolean },
): string => {
    const throwsEntry = spec.throws ? ", throws: true" : "";
    return call("fn", [
        quote(lib),
        quote(cIdentifier),
        `{ args: ${spec.args}, returns: ${spec.returns}${throwsEntry} }`,
    ]);
};
