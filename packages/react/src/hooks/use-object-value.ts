import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";

type ObjectValueCache<T extends GObject.Object, V> = {
    object: T | null;
    signal: string;
    value: V;
};

export function useObjectValue<T extends GObject.Object, V>(
    object: RefProp<T>,
    signal: string,
    read: (object: T | null) => V,
): V {
    const resolved = resolveRefProp(object);
    const cacheRef = useRef<ObjectValueCache<T, V> | null>(null);

    const readCached = useCallback((): ObjectValueCache<T, V> => {
        const cache = { object: resolved, signal, value: read(resolved) };
        cacheRef.current = cache;
        return cache;
    }, [resolved, signal]);

    const getSnapshot = useCallback((): V => {
        const cache = cacheRef.current;

        if (cache !== null && cache.object === resolved && cache.signal === signal) {
            return cache.value;
        }
        return readCached().value;
    }, [resolved, signal, readCached]);

    const subscribe = useCallback(
        (onStoreChange: () => void): (() => void) => {
            if (resolved === null) return () => {};

            const handler: SignalHandler = () => {
                readCached();
                onStoreChange();
            };

            resolved.on(signal, handler);
            return () => resolved.off(signal, handler);
        },
        [resolved, signal, readCached],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
