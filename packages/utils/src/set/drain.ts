/**
 * Iterates every item currently in `set`, then clears it. Use it to drain a set of pending work
 * accumulated since the last drain.
 *
 * @template T - The set item type.
 * @param set - The set to drain and clear.
 * @param visit - Called with each item before the set is cleared.
 */
const drain = <T>(set: Set<T>, visit: (item: T) => void): void => {
    for (const item of set) {
        visit(item);
    }

    set.clear();
};

export { drain };
