import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";

type ObjectValueCache<T extends GObject.Object, V> = {
    object: T | null;
    signal: string;
    value: V;
};

function useObjectValue<T extends GObject.Object, V>(
    object: RefProp<T>,
    signal: string,
    read: (object: T | null) => V,
): V {
    const resolved = resolveRefProp(object);
    const cacheRef = useRef<ObjectValueCache<T, V> | null>(null);

    const subscribe = useCallback(
        (onStoreChange: () => void): (() => void) => {
            if (resolved === null) {
                return (): void => undefined;
            }

            const handler: SignalHandler = () => {
                cacheRef.current = null;
                onStoreChange();
            };

            resolved.on(signal, handler);

            return () => resolved.off(signal, handler);
        },
        [resolved, signal],
    );

    const getSnapshot = (): ObjectValueCache<T, V> => {
        const currentObject = resolveRefProp(object);
        const cache = cacheRef.current;

        if (cache !== null && cache.object === currentObject && cache.signal === signal) {
            return cache;
        }

        const value = read(currentObject);
        cacheRef.current = { object: currentObject, signal, value };

        return cacheRef.current;
    };

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).value;
}

export { useObjectValue };
