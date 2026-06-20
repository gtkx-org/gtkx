type AttachListener = () => void;

const LISTENERS = new WeakMap<object, Set<AttachListener>>();

export const onOrderedAttach = (parent: object, listener: AttachListener): (() => void) => {
    let set = LISTENERS.get(parent);
    if (!set) {
        set = new Set();
        LISTENERS.set(parent, set);
    }
    set.add(listener);
    return () => {
        set.delete(listener);
    };
};

export const notifyOrderedAttach = (parent: object): void => {
    const set = LISTENERS.get(parent);
    if (!set) return;
    for (const listener of [...set]) listener();
};
