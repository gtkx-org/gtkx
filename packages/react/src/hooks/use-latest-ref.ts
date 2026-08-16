import { type RefObject, useInsertionEffect, useRef } from "react";

function useLatestRef<T>(value: T): RefObject<T> {
    const ref = useRef(value);

    useInsertionEffect(() => {
        ref.current = value;
    });

    return ref;
}

export { useLatestRef };
