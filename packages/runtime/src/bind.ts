import { call, type Descriptor, bind as nativeBind } from "@gtkx/native";

/**
 * Precompiles a call to a C function, marshalling the values it is given through the argument
 * descriptors and the result through the return one. The symbol is resolved in the shared library
 * on the first call.
 *
 * @param sharedLibrary The shared library to resolve the symbol in.
 * @param symbol The name of the C function to bind.
 * @param argDescriptors Describe the C arguments, in declaration order.
 * @param returnDescriptor Describes the C return value.
 * @returns A function calling the bound symbol.
 */
function bind(
    sharedLibrary: string,
    symbol: string,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): (...values: unknown[]) => unknown {
    const descriptor = nativeBind(sharedLibrary, symbol, argDescriptors, returnDescriptor);

    return (...values) => call(descriptor, values);
}

function createBindCache(): (key: string, ...args: Parameters<typeof bind>) => ReturnType<typeof bind> {
    const cache: Map<string, ReturnType<typeof bind>> = new Map();

    return (key, ...args) => cache.getOrInsertComputed(key, () => bind(...args));
}

export { bind, createBindCache };
