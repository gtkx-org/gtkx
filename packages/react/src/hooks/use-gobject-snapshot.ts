import type { SignalHandler } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { type GObjectTarget, resolveGobjectTarget } from "../utils/gobject-target.js";

interface SnapshotCache<T extends GObject.Object, V> {
    target: T | null;
    signal: string;
    value: V;
}

/**
 * Subscribes to a GObject signal on a (possibly late-resolving) target and exposes the
 * value read from that target as a tear-free React snapshot via `useSyncExternalStore`.
 *
 * The value is read in the signal handler (and once on first read / target change) and cached,
 * so `getSnapshot` is pure — it never issues a native read and therefore never drains the GLib
 * inbox. That purity matters because a native read (e.g. `getNItems`) synchronously runs any
 * pending GTK work, including a frame-clock fill that mutates the watched model; a `getSnapshot`
 * that read live would make the snapshot change as a side effect of being read, and React's
 * post-commit store re-check would spin. The handler's read is guarded against re-entrancy (a read
 * that drains a nested emission does not read again), so the cached value stays consistent for
 * `getSnapshot` across a render pass.
 *
 * @param target A GObject, a ref to one, or `null`/`undefined` while it is still resolving.
 * @param signal The signal whose emission refreshes the snapshot (e.g. `notify::label`).
 * @param read Reads the snapshot value from the resolved target, or from `null` when unresolved.
 * @param after Whether to connect the signal handler after the default handler runs.
 * @returns The latest snapshot value, consistent across a concurrent render pass.
 */
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
