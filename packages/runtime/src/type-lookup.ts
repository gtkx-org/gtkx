import { bindFunctionPointer, call, resolveFunctionOptional } from "./native.js";

const resolvedTypes: Map<string, Map<string, bigint>> = new Map();

/**
 * Resolves the GType produced by a `get_type` function in a shared library, caching
 * the result per library and function name. Returns zero when the symbol is absent;
 * library-loading and invocation errors propagate to the caller.
 * @param sharedLibrary Path or name of the shared library exporting the function.
 * @param typeFnName Name of the `*_get_type` function to call.
 */
const resolveType = (sharedLibrary: string, typeFnName: string): bigint => {
    const library = resolvedTypes.getOrInsertComputed(sharedLibrary, () => new Map());

    return library.getOrInsertComputed(typeFnName, () => {
        const handle = resolveFunctionOptional(sharedLibrary, typeFnName);
        if (handle == null) {
            return 0n;
        }
        const descriptor = bindFunctionPointer(handle, [], { kind: "biguint64" }, typeFnName, { argOrder: [] });

        return call(descriptor, []).value as bigint;
    });
};

export { resolveType };
