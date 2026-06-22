import { quote } from "@gtkx/utils";
import { joinArgs } from "../dsl/emit.js";

export type Ownership = "borrowed" | "full";

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

export const tVoid: string = T.void;

/** @public */
export const tBoolean: string = T.boolean;

/** @public */
export const tUint8: string = T.uint8;

export const tUint32: string = T.uint32;

export const tInt32: string = T.int32;

export const tUint64: string = T.uint64;

export const tBigUint64: string = T.biguint64;

/** @public */
export const tBlob: string = T.blob;

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

export const tScalar = (name: ScalarDescriptorName): string => T[name];

export const tString = (ownership: Ownership, length?: string): string => call("string", [quote(ownership), length]);

export const tObject = (ownership: Ownership, typeName?: string): string =>
    call("object", [quote(ownership), typeName === undefined ? undefined : quote(typeName)]);

export type BoxedOptions = {
    ownership: Ownership;
    library: string | undefined;
    getTypeFn: string;
    callerAllocated: boolean;
};

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

export type StructOptions = {
    size: number | string | undefined;
    wrapperClass: string | undefined;
    callerAllocated: boolean;
};

export const tStruct = (ownership: Ownership, options: StructOptions): string =>
    call("struct", [
        quote(ownership),
        optionsObject([
            options.size === undefined ? undefined : `size: ${options.size}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
            options.callerAllocated ? "callerAllocated: true" : undefined,
        ]),
    ]);

/** @public */
export const tInlineStruct = (): string =>
    tStruct("borrowed", { size: undefined, wrapperClass: undefined, callerAllocated: false });

export type FundamentalOptions = {
    ownership: Ownership;
    typeName: string | undefined;
    wrapperClass: string | undefined;
};

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

export const tRef = (inner: string, inout = false): string => call("ref", [inner, inout ? "true" : undefined]);

export const tHashTable = (key: string, value: string, ownership: Ownership): string =>
    call("hashTable", [key, value, quote(ownership)]);

export const tEnum = (lib: string, getType: string, signed: boolean): string =>
    call("enum", [quote(lib), quote(getType), String(signed)]);

export const tFlags = (lib: string, getType: string, signed: boolean): string =>
    call("flags", [quote(lib), quote(getType), String(signed)]);

export const tByteArray = (ownership: Ownership): string => call("byteArray", [quote(ownership)]);

export type ListDescriptorName = "list" | "slist" | "ptrArray" | "garray";

export const tList = (name: ListDescriptorName, element: string, ownership: Ownership): string =>
    call(name, [element, quote(ownership)]);

export const tArray = (element: string, kind?: string, ownership?: Ownership, elementSize?: number): string =>
    call("array", [
        element,
        kind === undefined ? undefined : quote(kind),
        ownership === undefined ? undefined : quote(ownership),
        elementSize === undefined ? undefined : `{ elementSize: ${elementSize} }`,
    ]);

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

export const tFixedArray = (element: string, length: number, ownership?: Ownership, elementSize?: number): string =>
    call("fixedArray", [
        element,
        String(length),
        ownership === undefined ? undefined : quote(ownership),
        elementSize === undefined ? undefined : String(elementSize),
    ]);

export const tCallback = (argTypes: string[], returnType: string, options?: string): string =>
    call("callback", [`[${argTypes.join(", ")}]`, returnType, options]);

export type BindArgs = {
    libExpr: string;
    symbolExpr: string;
    argList: string;
    returnType: string;
};

export const tBind = (args: BindArgs): string =>
    call("bind", [args.libExpr, args.symbolExpr, args.argList, args.returnType]);

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
