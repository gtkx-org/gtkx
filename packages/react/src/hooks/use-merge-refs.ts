import { type Ref, type RefCallback, useCallback } from "react";

/**
 * Combines several refs into a single setter. The returned {@link RefCallback}
 * forwards the value to every supplied ref: object refs receive it on their
 * `.current`, and function refs are invoked with it.
 *
 * @typeParam T - The instance type the merged refs accept.
 * @param refs - The refs to forward the value to; `null` or `undefined` entries are ignored.
 * @returns A memoized setter that fans the value out to every supplied ref.
 */
export const useMergeRefs = <T>(...refs: Array<Ref<T | null> | undefined>): RefCallback<T> => {
    return useCallback<RefCallback<T>>((value) => {
        for (const ref of refs) {
            if (typeof ref === "function") {
                ref(value);
            } else if (ref) {
                ref.current = value;
            }
        }
    }, refs);
};
