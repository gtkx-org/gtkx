export const uniqBy = <T>(items: T[], key: (item: T) => string): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        const identity = key(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
        result.push(item);
    }
    return result;
};

const compareStrings = (a: string, b: string): number => a.localeCompare(b);

export const sortedStrings = (values: Iterable<string>): string[] => [...values].sort(compareStrings);

export const sortedStringsBy = <T>(items: Iterable<T>, key: (item: T) => string): T[] =>
    [...items].sort((a, b) => compareStrings(key(a), key(b)));

export const shallowEqual = <T extends Record<string, unknown>>(a?: T, b?: T): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }

    return true;
};
