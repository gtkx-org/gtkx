import { type Ref, type RefCallback, useCallback } from "react";

export const useMergeRefs = <T>(...refs: Array<Ref<T | null> | undefined>): RefCallback<T> => {
    return useCallback<RefCallback<T>>((value) => {
        const cleanups = refs.map((ref) => {
            if (typeof ref === "function") {
                const cleanup = ref(value);
                return typeof cleanup === "function" ? cleanup : () => ref(null);
            }
            if (ref) {
                ref.current = value;
                return () => {
                    ref.current = null;
                };
            }
            return undefined;
        });
        return () => {
            for (const cleanup of cleanups) cleanup?.();
        };
    }, refs);
};
