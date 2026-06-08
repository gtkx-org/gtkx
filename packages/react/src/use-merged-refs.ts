import { type Ref, type RefCallback, useCallback } from "react";

/**
 * Writes a value into a single React ref, tolerating object refs, callback
 * refs, and absent refs.
 *
 * @typeParam T - The referenced instance type.
 * @param ref - The ref to populate, or `undefined`/`null` when none was given.
 * @param value - The current value to store, or `null` on detach.
 */
export const assignRef = <T>(ref: Ref<T> | undefined, value: T | null): void => {
    if (typeof ref === "function") {
        ref(value);
    } else if (ref) {
        ref.current = value;
    }
};

/**
 * Combines two refs into one stable callback ref.
 *
 * Both refs receive the same value whenever the merged ref is invoked, letting a
 * component capture an instance internally while still forwarding it to a
 * caller-supplied ref. The returned callback identity changes only when either
 * ref changes.
 *
 * @typeParam T - The referenced instance type.
 * @param internal - The component's own ref, always populated.
 * @param external - The caller-supplied ref, populated when provided.
 * @returns A callback ref that fans the value out to both refs.
 */
export const useMergedRefs = <T>(internal: Ref<T>, external: Ref<T> | undefined): RefCallback<T> =>
    useCallback(
        (value: T | null) => {
            assignRef(internal, value);
            assignRef(external, value);
        },
        [internal, external],
    );
