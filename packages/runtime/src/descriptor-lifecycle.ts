import {
    bind,
    type BoundCall,
    call,
    compileDescriptor,
    type ExternalObject,
    type Handle,
    resolveFunction,
} from "./native.js";
import { LIB } from "./library.js";

const encoder = new TextEncoder();
type FunctionResolver = () => ExternalObject<Handle>;
type TypeResolver = () => bigint;

const functions: Map<string, FunctionResolver> = new Map();
const types: Map<string, TypeResolver> = new Map();
const getters: Map<string, BoundCall> = new Map();
let typeFromName: BoundCall | undefined;

const lookupType = (name: string): bigint => {
    if (name.includes("\0")) {
        throw new TypeError("Native type names must not contain NUL bytes");
    }
    typeFromName ??= bind(
        LIB,
        "g_type_from_name",
        [compileDescriptor({ kind: "bytes", ownership: "borrowed", hasOwnedStorage: false })],
        compileDescriptor({ kind: "biguint64", isDirectWord: false }),
        { argOrder: [0] },
    );
    return call(typeFromName, [encoder.encode(name)]).value as bigint;
};

const invokeTypeGetter = (sharedLibrary: string, symbol: string): bigint => {
    const key = JSON.stringify([sharedLibrary, symbol]);
    const getter = getters.getOrInsertComputed(key, () =>
        bind(sharedLibrary, symbol, [], compileDescriptor({ kind: "biguint64", isDirectWord: false }), {
            argOrder: [],
        }),
    );
    return call(getter, []).value as bigint;
};

const typeResolver = (name: string, sharedLibrary?: string, getTypeFnName?: string): TypeResolver => {
    const key = JSON.stringify([name, sharedLibrary, getTypeFnName]);
    return types.getOrInsertComputed(key, () => {
        let resolved = 0n;
        return () => {
            if (resolved !== 0n) return resolved;
            const registered = lookupType(name);
            resolved =
                registered !== 0n || sharedLibrary === undefined || getTypeFnName === undefined
                    ? registered
                    : invokeTypeGetter(sharedLibrary, getTypeFnName);
            return resolved;
        };
    });
};

const functionResolver = (sharedLibrary: string, symbol: string): FunctionResolver => {
    const key = JSON.stringify([sharedLibrary, symbol]);
    return functions.getOrInsertComputed(key, () => {
        let resolved: ExternalObject<Handle> | undefined;
        return () => (resolved ??= resolveFunction(sharedLibrary, symbol));
    });
};

export { functionResolver, typeResolver };
