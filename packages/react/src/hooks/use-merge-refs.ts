import { type Ref, type RefCallback, useCallback } from "react";

/**
 * Combines several refs into a single setter. The returned {@link RefCallback}
 * forwards the value to every supplied ref: object refs receive it on their
 * `.current`, and function refs are invoked with it.
 *
 * Honors the React ref-cleanup protocol: when the element detaches, each object
 * ref is reset to `null` and each function ref's returned cleanup is run (or the
 * function ref is invoked with `null` when it returns no cleanup).
 *
 * @typeParam T - The instance type the merged refs accept.
 * @param refs - The refs to forward the value to; `null` or `undefined` entries are ignored.
 * @returns A memoized setter that fans the value out to every supplied ref.
 */
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
