/**
 * Returns a new array of the unique elements of `arr`, keyed by the value the `mapper` returns.
 *
 * When two elements map to the same key the first occurrence is kept and later ones discarded,
 * preserving first-seen order.
 *
 * @template T - The type of elements in the array.
 * @param arr - The array to deduplicate.
 * @param mapper - Maps an element to the key its uniqueness is decided by.
 * @returns A new array containing only the first element seen for each distinct key.
 *
 * @example
 * uniqBy([2.1, 1.2, 2.3], Math.floor); // [2.1, 1.2]
 * uniqBy([{ id: "a" }, { id: "a" }, { id: "b" }], (item) => item.id); // [{ id: "a" }, { id: "b" }]
 */
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
