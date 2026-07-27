type GetSet<K, V> = {
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
    has(key: K): boolean;
};

/**
 * Returns the value stored under `key`, or inserts and returns the value produced by `factory` when
 * the key is absent. Works with both `Map` and `WeakMap`, and caches a computed `undefined` value.
 *
 * @template K - The key type.
 * @template V - The value type.
 * @param map - The `Map` or `WeakMap` to read from and populate.
 * @param key - The key to look up.
 * @param factory - Produces the value to insert when `key` is absent; called at most once.
 * @returns The existing or newly-inserted value.
 *
 * @example
 * const counts = new Map<string, number[]>();
 * getOrInsert(counts, "a", () => []).push(1); // counts is Map { "a" => [1] }
 */
function getOrInsert<K, V>(map: GetSet<K, V>, key: K, factory: (key: K) => V): V {
    if (map.has(key)) {
        return map.get(key) as V;
    }

    const value = factory(key);
    map.set(key, value);

    return value;
}

export { getOrInsert, type GetSet };
