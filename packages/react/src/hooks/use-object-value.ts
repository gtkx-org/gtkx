import { offSignal, onSignal, type SignalHandler } from "@gtkx/runtime";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { type RefProp, resolveRefProp } from "../utils/ref-prop.js";

type ObjectValueCache<T extends object, V> = {
    object: T | null;
    signal: string;
    value: V;
};

function useObjectValue<T extends object, V>(
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

            onSignal(resolved, signal, handler);

            return () => {
                offSignal(resolved, signal, handler);
            };
        },
        [resolved, signal],
    );

    const getSnapshot = (): V => {
        const cache = cacheRef.current;

        if (cache !== null && cache.object === resolved && cache.signal === signal) {
            return cache.value;
        }

        const value = read(resolved);
        cacheRef.current = { object: resolved, signal, value };

        return value;
    };

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { useObjectValue };
