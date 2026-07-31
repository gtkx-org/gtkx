import { areObjectKeysEqual } from "./are-object-keys-equal.ts";
import { isPlainObject } from "./is-plain-object.ts";

const isStrictEqual = (a: unknown, b: unknown): boolean => a === b;

function isShallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        return areObjectKeysEqual(a, b, isStrictEqual);
    }

    return false;
}

export { isShallowEqual };
