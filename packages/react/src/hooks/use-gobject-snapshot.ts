import type { SignalHandler } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { type GObjectTarget, resolveGobjectTarget } from "../utils/gobject-target.js";

interface SnapshotCache<T extends GObject.Object, V> {
    target: T | null;
    signal: string;
    value: V;
}

export function useGObjectSnapshot<T extends GObject.Object, V>(
    target: GObjectTarget<T>,
    signal: string,
    read: (target: T | null) => V,
    after = false,
): V {
    const resolved = resolveGobjectTarget(target);
    const readRef = useRef(read);
    readRef.current = read;
    const cacheRef = useRef<SnapshotCache<T, V> | null>(null);
    const readingRef = useRef(false);
    const onChangeRef = useRef<() => void>(() => {});

    const readNow = useCallback((): void => {
        if (readingRef.current) return;
        readingRef.current = true;
        try {
            cacheRef.current = { target: resolved, signal, value: readRef.current(resolved) };
        } finally {
            readingRef.current = false;
        }
    }, [resolved, signal]);

    const refresh = useCallback((): void => {
        readNow();
        onChangeRef.current();
    }, [readNow]);

    const getSnapshot = useCallback((): V => {
        const cache = cacheRef.current;
        if (cache !== null && cache.target === resolved && cache.signal === signal) {
            return cache.value;
        }
        readNow();
        return cacheRef.current?.value ?? readRef.current(resolved);
    }, [resolved, signal, readNow]);

    const subscribe = useCallback(
        (onStoreChange: () => void): (() => void) => {
            if (resolved === null) return () => {};
            onChangeRef.current = onStoreChange;
            const handler: SignalHandler = () => refresh();
            resolved.on(signal, handler, after);
            return () => resolved.off(signal, handler);
        },
        [resolved, signal, after, refresh],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
