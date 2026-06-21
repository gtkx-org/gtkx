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
 * The value is re-read only when the signal fires, when the resolved target changes, or
 * when the watched signal changes, so the returned reference stays stable between
 * emissions regardless of the underlying value type (including freshly minted boxed,
 * variant, or string-array values that cannot be compared structurally).
 *
 * @param target A GObject, a ref to one, or `null`/`undefined` while it is still resolving.
 * @param signal The signal whose emission invalidates the snapshot (e.g. `notify::label`).
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
    const dirtyRef = useRef(false);
    const cacheRef = useRef<SnapshotCache<T, V> | null>(null);

    const getSnapshot = useCallback((): V => {
        const cache = cacheRef.current;
        if (cache !== null && !dirtyRef.current && cache.target === resolved && cache.signal === signal) {
            return cache.value;
        }
        dirtyRef.current = false;
        const value = readRef.current(resolved);
        cacheRef.current = { target: resolved, signal, value };
        return value;
    }, [resolved, signal]);

    const subscribe = useCallback(
        (onStoreChange: () => void): (() => void) => {
            if (resolved === null) return () => {};
            const handler: SignalHandler = () => {
                dirtyRef.current = true;
                onStoreChange();
            };
            resolved.on(signal, handler, after);
            return () => resolved.off(signal, handler);
        },
        [resolved, signal, after],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
