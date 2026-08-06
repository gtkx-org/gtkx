type GetSet<K, V> = {
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
    has(key: K): boolean;
};

function getOrInsert<K, V>(map: GetSet<K, V>, key: K, factory: (key: K) => V): V {
    if (map.has(key)) {
        return map.get(key) as V;
    }

    const value = factory(key);
    map.set(key, value);

    return value;
}

export { getOrInsert };
