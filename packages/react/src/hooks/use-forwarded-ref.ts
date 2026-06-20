import { type Ref, type RefCallback, type RefObject, useCallback, useRef } from "react";

export const useForwardedRef = <T>(
    external: Ref<T> | undefined,
    capture?: (value: T | null) => void,
): [RefObject<T | null>, RefCallback<T>] => {
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
