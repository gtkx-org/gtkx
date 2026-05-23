const ids = new WeakMap<object, string>();
let nextId = 0;

/**
 * Returns a stable, unique string identifier for the given object. Used as a
 * React `key` value for live native instances. The identifier is associated
 * with the JavaScript wrapper itself, so callers do not need to access the
 * underlying native handle to derive a key.
 */
export const widgetIdOf = (obj: object): string => {
    let id = ids.get(obj);
    if (!id) {
        id = String(++nextId);
        ids.set(obj, id);
    }
    return id;
};
