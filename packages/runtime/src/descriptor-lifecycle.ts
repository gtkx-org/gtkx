import {
    bind,
    type BoundCall,
    call,
    createFunctionResolver,
    createTypeResolver,
    type ExternalObject,
    type FunctionResolver,
    resolveFunction,
    type TypeResolver,
} from "./native.js";
import { LIB } from "./library.js";

const encoder = new TextEncoder();
const functions: Map<string, ExternalObject<FunctionResolver>> = new Map();
const types: Map<string, ExternalObject<TypeResolver>> = new Map();
const getters: Map<string, BoundCall> = new Map();
let typeFromName: BoundCall | undefined;

const lookupType = (name: string): bigint => {
    if (name.includes("\0")) {
        throw new TypeError("Native type names must not contain NUL bytes");
    }
    typeFromName ??= bind(
        LIB,
        "g_type_from_name",
        [{ kind: "bytes", ownership: "borrowed", hasOwnedStorage: false }],
        { kind: "biguint64", isDirectWord: false },
        { argOrder: [0] },
    );
    return call(typeFromName, [encoder.encode(name)]).value as bigint;
};

const invokeTypeGetter = (sharedLibrary: string, symbol: string): bigint => {
    const key = JSON.stringify([sharedLibrary, symbol]);
    const getter = getters.getOrInsertComputed(key, () =>
        bind(sharedLibrary, symbol, [], { kind: "biguint64", isDirectWord: false }, { argOrder: [] }),
    );
    return call(getter, []).value as bigint;
};

const typeResolver = (name: string, sharedLibrary?: string, getTypeFnName?: string): ExternalObject<TypeResolver> => {
    const key = JSON.stringify([name, sharedLibrary, getTypeFnName]);
    return types.getOrInsertComputed(key, () =>
        createTypeResolver(() => {
            const registered = lookupType(name);
            return registered !== 0n || sharedLibrary === undefined || getTypeFnName === undefined
                ? registered
                : invokeTypeGetter(sharedLibrary, getTypeFnName);
        }),
    );
};

const functionResolver = (sharedLibrary: string, symbol: string): ExternalObject<FunctionResolver> => {
    const key = JSON.stringify([sharedLibrary, symbol]);
    return functions.getOrInsertComputed(key, () =>
        createFunctionResolver(() => resolveFunction(sharedLibrary, symbol)),
    );
};

export { functionResolver, typeResolver };
