import { type Ref, type RefCallback, type RefObject, useCallback, useRef } from "react";

/**
 * Captures a component's own instance while forwarding it to a caller-supplied
 * ref.
 *
 * Owns an internal ref object and pairs it with a stable callback ref. When the
 * callback fires it routes the value to `capture` if one was supplied, otherwise
 * stores it in the internal ref, and in either case writes it to `external`,
 * tolerating object refs, callback refs, and an absent ref. The callback
 * identity changes only when `external` or `capture` changes.
 *
 * @typeParam T - The referenced instance type.
 * @param external - The caller-supplied ref, populated when provided.
 * @param capture - An optional sink that receives the value in place of the
 *   internal ref.
 * @returns The internal ref object paired with the callback ref to bind.
 */
export const useForwardedRef = <T>(
    external: Ref<T> | undefined,
    capture?: (value: T | null) => void,
): readonly [RefObject<T | null>, RefCallback<T>] => {
    const internal = useRef<T | null>(null);
    const setRef = useCallback<RefCallback<T>>(
        (value) => {
            if (capture) {
                capture(value);
            } else {
                internal.current = value;
            }
            if (typeof external === "function") {
                external(value);
            } else if (external) {
                external.current = value;
            }
        },
        [external, capture],
    );
    return [internal, setRef];
};
