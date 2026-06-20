export const omit = <T extends Record<string, unknown>>(record: T, keys: string[]): T => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
        if (!keys.includes(key)) {
            result[key] = record[key];
        }
    }
    return result as T;
};

export const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
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

export const compareAlpha = (a: string, b: string): number => a.localeCompare(b);

export const sortedAlpha = (values: Iterable<string>): string[] => [...values].sort(compareAlpha);

export const sortedAlphaBy = <T>(items: Iterable<T>, key: (item: T) => string): T[] =>
    [...items].sort((a, b) => compareAlpha(key(a), key(b)));

export const reverseNumericEnum = (enumObject: Record<string, string | number>): Map<number, string> =>
    new Map<number, string>(
        Object.entries(enumObject)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .map(([name, value]) => [value, name]),
    );
