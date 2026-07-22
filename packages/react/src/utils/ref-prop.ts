import type { RefObject } from "react";

export type RefProp<T> = T | RefObject<T | null> | null | undefined;

export const resolveRefProp = <T>(prop: RefProp<T>): T | null => {
    if (!prop) return null;

    if (typeof prop === "object" && "current" in prop) {
        return prop.current;
    }

    return prop;
};
