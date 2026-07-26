import { isRecord } from "@gtkx/utils";
import { type Ref, type RefCallback, useCallback } from "react";

type PossibleRef<T> = Ref<T> | undefined;
type RefCleanup<T> = ReturnType<RefCallback<T>>;

export function assignRef<T>(ref: PossibleRef<T>, value: T): RefCleanup<T> {
    if (typeof ref === "function") {
        return ref(value);
    }
    if (isRecord(ref) && "current" in ref) {
        ref.current = value;
    }
}

type CleanupMap<T> = Map<PossibleRef<T>, Exclude<RefCleanup<T>, void>>;

function collectCleanup<T>(cleanupMap: CleanupMap<T>, ref: PossibleRef<T>, node: T | null): void {
    const cleanup = assignRef(ref, node);
    if (cleanup) cleanupMap.set(ref, cleanup);
}

function cleanupRef<T>(cleanupMap: CleanupMap<T>, ref: PossibleRef<T>): void {
    const cleanup = cleanupMap.get(ref);
    if (cleanup && typeof cleanup === "function") cleanup();
    else assignRef(ref, null);
}

export function mergeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
    const cleanupMap: CleanupMap<T> = new Map();

    return (node: T | null): RefCleanup<T> => {
        for (const ref of refs) {
            collectCleanup(cleanupMap, ref, node);
        }
        if (cleanupMap.size === 0) return;
        return () => {
            for (const ref of refs) {
                cleanupRef(cleanupMap, ref);
            }
            cleanupMap.clear();
        };
    };
}

export function useMergedRef<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
    return useCallback(mergeRefs(...refs), refs);
}
