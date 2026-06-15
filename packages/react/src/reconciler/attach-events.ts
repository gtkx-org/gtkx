/**
 * Subscription point for ordered-insert attach activity.
 *
 * The element map's ordered-insert interpreter notifies after every attach,
 * reorder, or detach it performs on a parent. Components that own follow-up
 * work over the parent's final child set (e.g. the column view's settle pass)
 * subscribe by backing instance; coalescing is the subscriber's concern.
 */

type AttachListener = () => void;

const LISTENERS = new WeakMap<object, Set<AttachListener>>();

/**
 * Subscribes to ordered-insert attach activity on `parent`.
 *
 * @param parent - The backing GObject whose ordered children to observe.
 * @param listener - Invoked after every ordered attach, reorder, or detach.
 * @returns An unsubscribe function.
 */
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

/**
 * Notifies the subscribers of `parent` that an ordered attach, reorder, or
 * detach was performed.
 *
 * @param parent - The backing GObject whose ordered children changed.
 */
export const notifyOrderedAttach = (parent: object): void => {
    const set = LISTENERS.get(parent);
    if (!set) return;
    for (const listener of [...set]) listener();
};
