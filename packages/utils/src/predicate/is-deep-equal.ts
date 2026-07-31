import { areObjectKeysEqual } from "./are-object-keys-equal.ts";
import { isPlainObject } from "./is-plain-object.ts";

const isDeepArrayEqual = (a: unknown, b: unknown): boolean => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }

    return a.every((item, index) => isDeepEqual(item, b[index]));
};

function isDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        return isDeepArrayEqual(a, b);
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        return areObjectKeysEqual(a, b, isDeepEqual);
    }

    return false;
}

export { isDeepEqual };
