function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const excluded: Set<PropertyKey> = new Set(keys);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (!excluded.has(key)) {
            result[key] = value;
        }
    }

    return result as Omit<T, K>;
}

export { omit };
