/**
 * Coalesced end-of-commit work.
 *
 * A few host-side side-effects depend on the latest props but must run once,
 * after every mutation of a commit has applied: rebuilding a text view's buffer
 * from its content children, building a menu model once its host chain exists,
 * refreshing a list's portal cells. Each registers a stable callback through
 * {@link scheduleFlush}; the reconciler drains them in its `resetAfterCommit`
 * hook, before `unfreeze()` lets GTK repaint, so the work lands inside the same
 * `act()` boundary a test awaits.
 *
 * Callbacks are deduplicated by identity, so scheduling the same work several
 * times within one commit collapses to a single run. Callers that fire outside
 * a commit (a GTK signal handler) gate on {@link isInCommit} and fall back to a
 * deferred scheduler such as `queueMicrotask`.
 */

const pending = new Set<() => void>();
let inCommit = false;

/** Whether a React commit is currently on the stack. */
export const isInCommit = (): boolean => inCommit;

/** Marks the start of a commit; called from `prepareForCommit`. */
export const beginCommit = (): void => {
    inCommit = true;
};

/** Marks the end of a commit; called from `resetAfterCommit`. */
export const endCommit = (): void => {
    inCommit = false;
};

/**
 * Schedules `fn` to run once at the end of the current commit. Repeated calls
 * with the same reference before the flush collapse into a single run.
 *
 * @param fn - The stable callback to run when the commit flushes.
 */
export const scheduleFlush = (fn: () => void): void => {
    pending.add(fn);
};

/**
 * Runs and clears every scheduled flush callback. Reentrant: work that schedules
 * more work during its own run is picked up in the same drain.
 */
export const runCommitFlush = (): void => {
    while (pending.size > 0) {
        const batch = [...pending];
        pending.clear();
        for (const fn of batch) fn();
    }
};
