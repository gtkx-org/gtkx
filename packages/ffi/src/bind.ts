import { call, type Descriptor, bind as nativeBind } from "@gtkx/native";

export function bind(
    sharedLibrary: string,
    symbol: string,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): (...values: unknown[]) => unknown {
    const descriptor = nativeBind(sharedLibrary, symbol, argDescriptors, returnDescriptor);
    return (...values) => call(descriptor, values);
}

export function createBindCache(): (key: string, ...args: Parameters<typeof bind>) => ReturnType<typeof bind> {
    const cache = new Map<string, ReturnType<typeof bind>>();
    return (key, ...args) => {
        const existing = cache.get(key);
        if (existing !== undefined) return existing;
        const bound = bind(...args);
        cache.set(key, bound);
        return bound;
    };
}
