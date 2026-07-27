const areObjectKeysEqual = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    isValueEqual: (a: unknown, b: unknown) => boolean,
): boolean => {
    const keysA = Object.keys(a);

    if (keysA.length !== Object.keys(b).length) {
        return false;
    }

    return keysA.every((key) => Object.hasOwn(b, key) && isValueEqual(a[key], b[key]));
};

export { areObjectKeysEqual };
