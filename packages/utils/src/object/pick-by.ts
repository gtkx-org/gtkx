function pickBy<T extends Record<string, unknown>>(
    obj: T,
    shouldPick: (value: T[keyof T], key: keyof T) => boolean,
): Partial<T> {
    const result: Partial<T> = {};

    for (const key of Object.keys(obj) as (keyof T)[]) {
        const value = obj[key];

        if (shouldPick(value, key)) {
            result[key] = value;
        }
    }

    return result;
}

export { pickBy };
