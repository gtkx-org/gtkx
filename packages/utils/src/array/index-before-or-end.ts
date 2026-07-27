/**
 * Finds the index of the first item matching `before`, or `list.length` when `before` is `null` or
 * nothing matches. Use it to resolve where a new item should be inserted so it lands before the
 * referenced one, defaulting to the end.
 *
 * @template T - The list item type.
 * @template B - The reference value type.
 * @param list - The list to search.
 * @param before - The item to insert before, or `null` to target the end.
 * @param matches - Called with each item and the non-null `before`; return `true` on a match.
 * @returns The matched index, or `list.length`.
 */
const indexBeforeOrEnd = <T, B>(
    list: T[],
    before: B | null,
    matches: (item: T, before: B) => boolean,
): number => {
    if (before === null) {
        return list.length;
    }

    const index = list.findIndex((item) => matches(item, before));

    return index === -1 ? list.length : index;
};

export { indexBeforeOrEnd };
