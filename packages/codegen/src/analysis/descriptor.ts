import { sourceStringLiteral } from "@gtkx/utils";
import { joinArgs } from "../writer/emit.js";

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
    | "gtype"
    | "float32"
    | "float64"
    | "boolean"
    | "void"
    | "unichar"
    | "buffer"
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
    | "gArray"
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
    gtype: "t.gtype",
    float32: "t.float32",
    float64: "t.float64",
    boolean: "t.boolean",
    void: "t.void",
    unichar: "t.unichar",
    buffer: "t.buffer",
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
    gArray: "t.gArray",
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

export const tBoolean: string = T.boolean;

export const tUint8: string = T.uint8;

export const tUint32: string = T.uint32;

export const tInt32: string = T.int32;

export const tUint64: string = T.uint64;

export const tGtype: string = T.gtype;

export const tBuffer: string = T.buffer;

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

export const tString = (ownership: Ownership, length?: string): string =>
    call("string", [sourceStringLiteral(ownership), length]);

export const tObject = (ownership: Ownership): string => call("object", [sourceStringLiteral(ownership)]);

export type BoxedOptions = {
    ownership: Ownership;
    sharedLibrary: string | undefined;
    getTypeFnName: string;
    callerAllocated: boolean;
    size: number | undefined;
};

export const tBoxed = (glibName: string, options: BoxedOptions): string =>
    call("boxed", [
        sourceStringLiteral(glibName),
        optionsObject([
            `ownership: ${sourceStringLiteral(options.ownership)}`,
            options.sharedLibrary === undefined
                ? undefined
                : `sharedLibrary: ${sourceStringLiteral(options.sharedLibrary)}`,
            `getTypeFnName: ${sourceStringLiteral(options.getTypeFnName)}`,
            options.callerAllocated ? "callerAllocated: true" : undefined,
            options.size === undefined ? undefined : `size: ${options.size}`,
        ]),
    ]);

export type StructOptions = {
    size: number | string | undefined;
    wrapperClass: string | undefined;
    callerAllocated: boolean;
};

export const tStruct = (ownership: Ownership, options: StructOptions): string =>
    call("struct", [
        sourceStringLiteral(ownership),
        optionsObject([
            options.size === undefined ? undefined : `size: ${options.size}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
            options.callerAllocated ? "callerAllocated: true" : undefined,
        ]),
    ]);

export const tInlineStruct = (): string =>
    tStruct("borrowed", { size: undefined, wrapperClass: undefined, callerAllocated: false });

export type FundamentalOptions = {
    ownership: Ownership;
    typeName: string | undefined;
    wrapperClass: string | undefined;
};

export const tFundamental = (lib: string, refFunc: string, unrefFunc: string, options: FundamentalOptions): string =>
    call("fundamental", [
        sourceStringLiteral(lib),
        sourceStringLiteral(refFunc),
        sourceStringLiteral(unrefFunc),
        optionsObject([
            `ownership: ${sourceStringLiteral(options.ownership)}`,
            options.typeName === undefined ? undefined : `typeName: ${sourceStringLiteral(options.typeName)}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
        ]),
    ]);

export const tRef = (inner: string, inout = false): string => call("ref", [inner, inout ? "true" : undefined]);

export const tHashTable = (key: string, value: string, ownership: Ownership): string =>
    call("hashTable", [key, value, sourceStringLiteral(ownership)]);

export const tEnum = (lib: string, getType: string, signed: boolean): string =>
    call("enum", [sourceStringLiteral(lib), sourceStringLiteral(getType), String(signed)]);

export const tFlags = (lib: string, getType: string, signed: boolean): string =>
    call("flags", [sourceStringLiteral(lib), sourceStringLiteral(getType), String(signed)]);

export const tByteArray = (ownership: Ownership): string => call("byteArray", [sourceStringLiteral(ownership)]);

export type ListDescriptorName = "list" | "slist" | "ptrArray" | "gArray";

export const tList = (name: ListDescriptorName, element: string, ownership: Ownership): string =>
    call(name, [element, sourceStringLiteral(ownership)]);

export const tArray = (element: string, ownership?: Ownership, elementSize?: number): string =>
    call("array", [
        element,
        ownership === undefined ? undefined : sourceStringLiteral("array"),
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
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
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
        elementSize === undefined ? undefined : String(elementSize),
    ]);

export const tFixedArray = (element: string, length: number, ownership?: Ownership, elementSize?: number): string =>
    call("fixedArray", [
        element,
        String(length),
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
        elementSize === undefined ? undefined : String(elementSize),
    ]);

export const tCallback = (argTypes: string[], returnType: string, options?: string): string =>
    call("callback", [`[${argTypes.join(", ")}]`, returnType, options]);

type BindArgs = {
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
        sourceStringLiteral(lib),
        sourceStringLiteral(cIdentifier),
        `{ args: ${spec.args}, returns: ${spec.returns}${throwsEntry} }`,
    ]);
};
