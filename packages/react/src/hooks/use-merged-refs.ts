import { isRecord } from "@gtkx/utils";
import { type Ref, type RefCallback, useCallback } from "react";

type PossibleRef<T> = Ref<T> | undefined;
type RefCleanup<T> = ReturnType<RefCallback<T>>;

export function assignRef<T>(ref: PossibleRef<T>, value: T): RefCleanup<T> {
    if (typeof ref === "function") {
        return ref(value);
    } else if (isRecord(ref) && "current" in ref) {
        ref.current = value;
    }
}

export function mergeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
    const cleanupMap = new Map<PossibleRef<T>, Exclude<RefCleanup<T>, void>>();

    return (node: T | null): RefCleanup<T> => {
        refs.forEach((ref) => {
            const cleanup = assignRef(ref, node);
            if (cleanup) {
                cleanupMap.set(ref, cleanup);
            }
        });

        if (cleanupMap.size > 0) {
            return () => {
                refs.forEach((ref) => {
                    const cleanup = cleanupMap.get(ref);
                    if (cleanup && typeof cleanup === "function") {
                        cleanup();
                    } else {
                        assignRef(ref, null);
                    }
                });
                cleanupMap.clear();
            };
        }
    };
}

export function useMergedRef<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
    return useCallback(mergeRefs(...refs), refs);
}
