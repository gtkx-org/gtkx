const ids = new WeakMap<object, string>();
let nextId = 0;

export const stableIdOf = (obj: object): string => {
    let id = ids.get(obj);
    if (!id) {
        id = String(++nextId);
        ids.set(obj, id);
    }
    return id;
};
