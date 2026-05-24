import { type RefObject, useRef } from "react";

/**
 * Mirrors a render-time value into a ref so it can be read from
 * stable callbacks (tick callbacks, signal handlers registered once)
 * without re-creating the callback on every value change.
 */
export const useLatest = <T>(value: T): RefObject<T> => {
    const ref = useRef(value);
    ref.current = value;
    return ref;
};
