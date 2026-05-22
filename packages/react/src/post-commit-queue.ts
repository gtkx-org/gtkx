/**
 * Post-commit work queue for host-side reconciler bookkeeping.
 *
 * React's commit phase is the right boundary for host-side side effects that
 * depend on the latest props but should run after every individual
 * `commitUpdate` call has finished. Scheduling such work via `queueMicrotask`
 * places it between commit and passive-effects, which leaves it invisible to
 * `useLayoutEffect` and forces test harnesses to insert an extra microtask
 * drain. Routing the work through this queue instead runs it synchronously
 * inside `resetAfterCommit`, before `unfreeze()` flushes batched FFI calls,
 * so it lands within the same `act()` boundary the test is already awaiting.
 *
 * Callers that fire outside a commit (e.g. GTK signal handlers) take the
 * microtask fallback so they still drain promptly without depending on a
 * future React render.
 */

const queue: Array<() => void> = [];
let inCommit = false;

/**
 * Marks the start of a React commit. Called by the host config's
 * `prepareForCommit` hook. Any `scheduleAfterCommit` calls between this and
 * the matching {@link drainAfterCommit} push onto the queue.
 */
export function beginCommit(): void {
    inCommit = true;
}

/**
 * Drains the queued post-commit work and marks the commit as ended. Called by
 * the host config's `resetAfterCommit` hook, before `unfreeze()`, so the
 * drained work still benefits from FFI batching.
 *
 * The drain is reentrant: work that schedules more work during its own
 * execution is appended and processed in the same pass.
 */
export function drainAfterCommit(): void {
    while (queue.length > 0) {
        const fn = queue.shift();
        if (fn) fn();
    }
    inCommit = false;
}

/**
 * Queues `fn` to run at the end of the current commit, or on the next
 * microtask if no commit is currently in progress.
 */
export function scheduleAfterCommit(fn: () => void): void {
    if (inCommit) {
        queue.push(fn);
    } else {
        queueMicrotask(fn);
    }
}
