import { isRecord } from "@gtkx/utils";
import { type Ref, type RefCallback, useMemo } from "react";

type PossibleRef<T> = Ref<T> | undefined;
type RefCleanup<T> = ReturnType<RefCallback<T>>;
type CleanupMap<T> = Map<PossibleRef<T>, Exclude<RefCleanup<T>, void>>;

function assignRef<T>(ref: PossibleRef<T>, value: T): RefCleanup<T> {
    if (typeof ref === "function") {
        return ref(value);
    }

    if (isRecord(ref) && "current" in ref) {
        ref.current = value;
    }
}

function collectCleanup<T>(cleanupMap: CleanupMap<T>, ref: PossibleRef<T>, node: T | null): void {
    const cleanup = assignRef(ref, node);

    if (cleanup) {
        cleanupMap.set(ref, cleanup);
    }
}

function cleanupRef<T>(cleanupMap: CleanupMap<T>, ref: PossibleRef<T>): void {
    const cleanup = cleanupMap.get(ref);

    if (cleanup && typeof cleanup === "function") {
        cleanup();
    } else {
        assignRef(ref, null);
    }
}

function applyRefs<T>(cleanupMap: CleanupMap<T>, refs: PossibleRef<T>[], node: T | null): RefCleanup<T> {
    for (const ref of refs) {
        collectCleanup(cleanupMap, ref, node);
    }

    if (cleanupMap.size === 0) {
        return;
    }

    return () => {
        for (const ref of refs) {
            cleanupRef(cleanupMap, ref);
        }

        cleanupMap.clear();
    };
}

function mergeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
    const cleanupMap: CleanupMap<T> = new Map();

    return (node: T | null): RefCleanup<T> => applyRefs(cleanupMap, refs, node);
}

function useMergedRef<T>(first: PossibleRef<T>, second: PossibleRef<T>): RefCallback<T> {
    return useMemo(() => mergeRefs(first, second), [first, second]);
}

export { useMergedRef };
