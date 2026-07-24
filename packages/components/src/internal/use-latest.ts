import { useRef } from "react";

export const useLatest = <T>(value: T): { current: T } => {
    const ref = useRef(value);
    ref.current = value;
    return ref;
};
