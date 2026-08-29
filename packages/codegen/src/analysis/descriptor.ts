import { sourceStringLiteral } from "@gtkx/utils";
import type { GirCursorBounds } from "../gir/parameter.js";
import { joinArgs, pure } from "../writer/emit.js";

type Ownership = "borrowed" | "full";

type DescriptorName =
    | "bind" |
    "int8" |
    "uint8" |
    "int16" |
    "uint16" |
    "int32" |
    "uint32" |
    "int64" |
    "uint64" |
    "bigint64" |
    "biguint64" |
    "gtype" |
    "float32" |
    "float64" |
    "boolean" |
    "void" |
    "unichar" |
    "buffer" |
    "string" |
    "object" |
    "boxed" |
    "struct" |
    "fundamental" |
    "ref" |
    "hashTable" |
    "enum" |
    "flags" |
    "array" |
    "list" |
    "slist" |
    "ptrArray" |
    "gArray" |
    "byteArray" |
    "sizedArray" |
    "fixedArray" |
    "cursorArray" |
    "callback" |
    "fn";

type DescriptorNames = { [K in DescriptorName]: `t.${K}` };

type ScalarDescriptorName =
    | "boolean" |
    "int8" |
    "uint8" |
    "int16" |
    "uint16" |
    "int32" |
    "uint32" |
    "int64" |
    "uint64" |
    "bigint64" |
    "biguint64" |
    "float32" |
    "float64" |
    "unichar";

type BoxedOptions = {
    ownership: Ownership;
    sharedLibrary: string | undefined;
    getTypeFnName: string;
    freeFnName: string | undefined;
    isCallerAllocated: boolean;
    isInline?: boolean;
    size: number | undefined;
    fallbackClass?: string | undefined;
};

type StructOptions = {
    size: number | string | undefined;
    wrapperClass: string | undefined;
    isCallerAllocated: boolean;
    isInline?: boolean;
};

type FundamentalOptions = {
    ownership: Ownership;
    typeName: string | undefined;
    wrapperClass: string | undefined;
    fallbackClass?: string | undefined;
    isCallerAllocated?: boolean | undefined;
    isInline?: boolean | undefined;
};

type ListDescriptorName = "list" | "slist" | "ptrArray" | "gArray";

type ArrayLayout = {
    elementSize?: number | undefined;
    isBytes: boolean;
    isCallerAllocated?: boolean | undefined;
};

type BindArgs = {
    libExpr: string;
    symbolExpr: string;
    argList: string;
    returnType: string;
};

type FnSpecParts = {
    args: string;
    returns: string;
    isReturnSkipped: boolean;
    isReturnUnpacked: boolean;
    canThrow: boolean;
};

type CallbackSpecParts = {
    argTypes: string[];
    returns: string;
    options: string[];
};

const SKIPPED_RETURN_ENTRY = "isReturnSkipped: true";
const UNPACKED_RETURN_ENTRY = "isReturnUnpacked: true";

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
    cursorArray: "t.cursorArray",
    callback: "t.callback",
    fn: "t.fn",
};

const tVoid: string = T.void;
const tBoolean: string = T.boolean;
const tUint8: string = T.uint8;
const tUint32: string = T.uint32;
const tInt32: string = T.int32;
const tUint64: string = T.uint64;
const tBiguint64: string = T.biguint64;
const tGtype: string = T.gtype;
const tBuffer: string = T.buffer;

const call = (name: DescriptorName, args: (string | undefined)[]): string => `${T[name]}(${joinArgs(args)})`;

const optionsObject = (parts: (string | undefined)[]): string | undefined => {
    const present = parts.filter((part): part is string => part !== undefined);

    return present.length === 0 ? undefined : `{ ${present.join(", ")} }`;
};

const optionalLiteralEntry = (key: string, value: string | undefined): string | undefined =>
    value === undefined ? undefined : `${key}: ${sourceStringLiteral(value)}`;

const tScalar = (name: ScalarDescriptorName): string => T[name];

const tString = (ownership: Ownership, length?: string): string =>
    call("string", [sourceStringLiteral(ownership), length]);

const tObject = (ownership: Ownership, fallbackClass?: string): string =>
    call("object", [sourceStringLiteral(ownership), fallbackClass]);

const tBoxed = (glibName: string, options: BoxedOptions): string =>
    call("boxed", [
        sourceStringLiteral(glibName),
        optionsObject([
            `ownership: ${sourceStringLiteral(options.ownership)}`,
            optionalLiteralEntry("sharedLibrary", options.sharedLibrary),
            `getTypeFnName: ${sourceStringLiteral(options.getTypeFnName)}`,
            optionalLiteralEntry("freeFnName", options.freeFnName),
            options.isCallerAllocated ? "isCallerAllocated: true" : undefined,
            options.isInline === true ? "isInline: true" : undefined,
            options.size === undefined ? undefined : `size: ${String(options.size)}`,
            options.fallbackClass === undefined ? undefined : `fallbackClass: ${options.fallbackClass}`,
        ]),
    ]);

const tStruct = (ownership: Ownership, options: StructOptions): string =>
    call("struct", [
        sourceStringLiteral(ownership),
        optionsObject([
            options.size === undefined ? undefined : `size: ${String(options.size)}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
            options.isCallerAllocated ? "isCallerAllocated: true" : undefined,
            options.isInline === true ? "isInline: true" : undefined,
        ]),
    ]);

const tInlineStruct = (): string =>
    tStruct("borrowed", { size: undefined, wrapperClass: undefined, isCallerAllocated: false });

const tFundamental = (lib: string, refFunc: string, unrefFunc: string, options: FundamentalOptions): string =>
    call("fundamental", [
        sourceStringLiteral(lib),
        sourceStringLiteral(refFunc),
        sourceStringLiteral(unrefFunc),
        optionsObject([
            `ownership: ${sourceStringLiteral(options.ownership)}`,
            options.typeName === undefined ? undefined : `typeName: ${sourceStringLiteral(options.typeName)}`,
            options.wrapperClass === undefined ? undefined : `wrapperClass: ${options.wrapperClass}`,
            options.fallbackClass === undefined ? undefined : `fallbackClass: ${options.fallbackClass}`,
            options.isCallerAllocated === true ? "isCallerAllocated: true" : undefined,
            options.isInline === true ? "isInline: true" : undefined,
        ]),
    ]);

const tRef = (inner: string, isInout = false): string => call("ref", [inner, isInout ? "true" : undefined]);

const tHashTable = (key: string, value: string, ownership: Ownership): string =>
    call("hashTable", [key, value, sourceStringLiteral(ownership)]);

const tEnum = (lib: string, typeFnName: string, isSigned: boolean): string =>
    call("enum", [sourceStringLiteral(lib), sourceStringLiteral(typeFnName), String(isSigned)]);

const tFlags = (lib: string, typeFnName: string, isSigned: boolean, mask?: number): string =>
    call("flags", [
        sourceStringLiteral(lib),
        sourceStringLiteral(typeFnName),
        String(isSigned),
        mask === undefined ? undefined : `0x${mask.toString(16)}`,
    ]);

const tByteArray = (ownership: Ownership): string => call("byteArray", [sourceStringLiteral(ownership)]);

const tList = (name: ListDescriptorName, element: string, ownership: Ownership): string =>
    call(name, [element, sourceStringLiteral(ownership)]);

const arrayLayoutArg = (ownership: Ownership | undefined, layout: ArrayLayout): string | undefined => {
    if (ownership === undefined) {
        return undefined;
    }

    const entries = [
        layout.elementSize === undefined ? undefined : `elementSize: ${String(layout.elementSize)}`,
        layout.isBytes ? "isBytes: true" : undefined,
        layout.isCallerAllocated === true ? "isCallerAllocated: true" : undefined,
    ].filter((entry): entry is string => entry !== undefined);

    return entries.length === 0 ? undefined : `{ ${entries.join(", ")} }`;
};

const tArray = (element: string, ownership: Ownership | undefined, layout: ArrayLayout): string =>
    call("array", [
        element,
        ownership === undefined ? undefined : sourceStringLiteral("array"),
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
        arrayLayoutArg(ownership, layout),
    ]);

const tSizedArray = (
    element: string,
    lengthIndex: number,
    ownership: Ownership | undefined,
    layout: ArrayLayout,
): string =>
    call("sizedArray", [
        element,
        String(lengthIndex),
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
        arrayLayoutArg(ownership, layout),
    ]);

const tCursorArray = (
    element: string,
    bounds: GirCursorBounds,
    ownership: Ownership | undefined,
    layout: ArrayLayout,
): string =>
    call("cursorArray", [
        element,
        `{ baseParamIndex: ${String(bounds.baseIndex)}, sizeParamIndex: ${String(bounds.lengthIndex)} }`,
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
        arrayLayoutArg(ownership, layout),
    ]);

const tFixedArray = (element: string, length: number, ownership: Ownership | undefined, layout: ArrayLayout): string =>
    call("fixedArray", [
        element,
        String(length),
        ownership === undefined ? undefined : sourceStringLiteral(ownership),
        arrayLayoutArg(ownership, layout),
    ]);

const tCallback = (spec: CallbackSpecParts): string => {
    const optionsArg = spec.options.length > 0 ? `{ ${spec.options.join(", ")} }` : undefined;

    return call("callback", [`[${spec.argTypes.join(", ")}]`, spec.returns, optionsArg]);
};

const tBind = (args: BindArgs): string =>
    call("bind", [args.libExpr, args.symbolExpr, args.argList, args.returnType]);

const tFn = (lib: string, cIdentifier: string, spec: FnSpecParts): string => {
    const skipEntry = spec.isReturnSkipped ? `, ${SKIPPED_RETURN_ENTRY}` : "";
    const unpackEntry = spec.isReturnUnpacked ? `, ${UNPACKED_RETURN_ENTRY}` : "";
    const throwsEntry = spec.canThrow ? ", canThrow: true" : "";

    return pure(
        call("fn", [
            sourceStringLiteral(lib),
            sourceStringLiteral(cIdentifier),
            `() => ({ args: ${spec.args}, returns: ${spec.returns}${skipEntry}${unpackEntry}${throwsEntry} })`,
        ]),
    );
};

export {
    tVoid,
    tBoolean,
    tUint8,
    tUint32,
    tInt32,
    tUint64,
    tBiguint64,
    tGtype,
    tBuffer,
    tScalar,
    tString,
    tObject,
    tBoxed,
    tStruct,
    tInlineStruct,
    tFundamental,
    tRef,
    tHashTable,
    tEnum,
    tFlags,
    tByteArray,
    tList,
    tArray,
    tSizedArray,
    tFixedArray,
    tCursorArray,
    tCallback,
    tBind,
    tFn,
    type ArrayLayout,
    type Ownership,
    type ScalarDescriptorName,
    type ListDescriptorName,
};
