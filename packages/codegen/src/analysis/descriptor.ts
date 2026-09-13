import type { Ownership } from "@gtkx/native";
import type { Descriptor } from "@gtkx/runtime";
import type { t } from "@gtkx/runtime";
import { sourceStringLiteral } from "@gtkx/utils";
import type { GirCursorBounds } from "../gir/parameter.js";
import { joinArgs, pure } from "../writer/emit.js";

type RuntimeDescriptors = typeof t;
type DescriptorName = keyof RuntimeDescriptors;
type ScalarDescriptorName = {
    [K in DescriptorName]: RuntimeDescriptors[K] extends Descriptor
        ? keyof RuntimeDescriptors[K] extends "kind"
            ? Exclude<K, "buffer" | "void">
            : never
        : never;
}[DescriptorName];

type SourceOptions<TOptions, TExpressions extends keyof TOptions = never> = {
    [K in keyof TOptions]: (K extends TExpressions ? string : TOptions[K]) | undefined;
};

type RuntimeBoxedOptions = NonNullable<Parameters<RuntimeDescriptors["boxed"]>[1]>;
type BoxedOptions = SourceOptions<RuntimeBoxedOptions, "fallbackClass"> &
    Required<Pick<RuntimeBoxedOptions, "ownership" | "getTypeFnName" | "isCallerAllocated">>;

type RuntimeStructOptions = NonNullable<Parameters<RuntimeDescriptors["struct"]>[1]>;
type StructOptions = SourceOptions<Omit<RuntimeStructOptions, "size">, "wrapperClass"> & {
    size?: RuntimeStructOptions["size"] | string;
};

type RuntimeFundamentalOptions = NonNullable<Parameters<RuntimeDescriptors["fundamental"]>[3]>;
type FundamentalOptions = SourceOptions<RuntimeFundamentalOptions, "wrapperClass" | "fallbackClass"> &
    Required<Pick<RuntimeFundamentalOptions, "ownership">>;

type ListDescriptorName = Extract<DescriptorName, "list" | "slist" | "ptrArray" | "gArray">;

type RuntimeArrayOptions = NonNullable<Parameters<RuntimeDescriptors["array"]>[3]>;
type ArrayLayout = Pick<RuntimeArrayOptions, "elementSize" | "isCallerAllocated" | "isZeroTerminated"> &
    Required<Pick<RuntimeArrayOptions, "isBytes">>;

type BindArgs = {
    libExpr: string;
    symbolExpr: string;
    argList: string;
    returnType: string;
};

type RuntimeFnSpec = Extract<Parameters<RuntimeDescriptors["fn"]>[2], { args: unknown }>;
type FnSpecParts = {
    args: string;
    returns: string;
} & Required<Pick<RuntimeFnSpec, "isReturnSkipped" | "isReturnUnpacked" | "canThrow">>;

type CallbackSpecParts = {
    argTypes: string[];
    returns: string;
    options: string[];
};

const SKIPPED_RETURN_ENTRY = "isReturnSkipped: true";
const UNPACKED_RETURN_ENTRY = "isReturnUnpacked: true";

const descriptorName = <TName extends DescriptorName>(name: TName): `t.${TName}` => `t.${name}`;

const tVoid: string = descriptorName("void");
const tBoolean: string = descriptorName("boolean");
const tUint8: string = descriptorName("uint8");
const tUint64: string = descriptorName("uint64");
const tBiguint64: string = descriptorName("biguint64");
const tGtype: string = descriptorName("gtype");
const tBuffer: string = descriptorName("buffer");

const call = (name: DescriptorName, args: (string | undefined)[]): string =>
    `${descriptorName(name)}(${joinArgs(args)})`;

const optionsObject = (parts: (string | undefined)[]): string | undefined => {
    const present = parts.filter((part): part is string => part !== undefined);

    return present.length === 0 ? undefined : `{ ${present.join(", ")} }`;
};

const optionalLiteralEntry = (key: string, value: string | undefined): string | undefined =>
    value === undefined ? undefined : `${key}: ${sourceStringLiteral(value)}`;

const tScalar = (name: ScalarDescriptorName): string => descriptorName(name);

const tString = (ownership: Ownership, length?: string, hasOwnedStorage = false): string =>
    call("string", [
        sourceStringLiteral(ownership),
        hasOwnedStorage ? (length ?? "undefined") : length,
        hasOwnedStorage ? "true" : undefined,
    ]);

const tObject = (ownership: Ownership, fallbackClass?: string, typeName?: string): string =>
    call("object", [
        sourceStringLiteral(ownership),
        typeName === undefined ? fallbackClass : (fallbackClass ?? "undefined"),
        typeName === undefined ? undefined : sourceStringLiteral(typeName),
    ]);

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
            optionalLiteralEntry("sharedLibrary", options.sharedLibrary),
            optionalLiteralEntry("copyFnName", options.copyFnName),
            optionalLiteralEntry("freeFnName", options.freeFnName),
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

const tEnum = (lib: string, typeFnName: string, isSigned: boolean, members?: number[]): string =>
    call("enum", [
        sourceStringLiteral(lib),
        sourceStringLiteral(typeFnName),
        String(isSigned),
        members === undefined ? undefined : `[${members.join(", ")}]`,
    ]);

const tFlags = (lib: string, typeFnName: string, isSigned: boolean, mask?: number): string =>
    call("flags", [
        sourceStringLiteral(lib),
        sourceStringLiteral(typeFnName),
        String(isSigned),
        mask === undefined ? undefined : `0x${mask.toString(16)}`,
    ]);

const tByteArray = (ownership: Ownership): string => call("byteArray", [sourceStringLiteral(ownership)]);

const ARRAY_LAYOUT_FLAGS = ["isBytes", "isCallerAllocated", "isZeroTerminated"] as const;

const arrayLayoutArg = (ownership: Ownership | undefined, layout: ArrayLayout): string | undefined => {
    if (ownership === undefined) {
        return undefined;
    }

    const entries = ARRAY_LAYOUT_FLAGS.filter((flag) => layout[flag] === true).map((flag) => `${flag}: true`);

    if (layout.elementSize !== undefined) {
        entries.unshift(`elementSize: ${String(layout.elementSize)}`);
    }

    return entries.length === 0 ? undefined : `{ ${entries.join(", ")} }`;
};

const tList = (
    name: ListDescriptorName,
    element: string,
    ownership: Ownership,
    layout: ArrayLayout,
): string => call(name, [element, sourceStringLiteral(ownership), arrayLayoutArg(ownership, layout)]);

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
    type ScalarDescriptorName,
    type ListDescriptorName,
};

export type { Ownership } from "@gtkx/native";
