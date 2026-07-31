function uniqBy<T>(arr: T[], mapper: (item: T, index: number, array: T[]) => unknown): T[] {
    const seen: Map<unknown, T> = new Map();
    let index = 0;

    for (const item of arr) {
        const key = mapper(item, index, arr);

        if (!seen.has(key)) {
            seen.set(key, item);
        }

        index++;
    }

    return seen.values().toArray();
}

export { uniqBy };
