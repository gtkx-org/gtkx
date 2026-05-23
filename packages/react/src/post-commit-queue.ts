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
 * Only call {@link scheduleAfterCommit} from inside a React render or commit;
 * anything queued outside that window sits until the next commit drains it.
 * Callers that fire outside the reconciler (e.g. GTK signal handlers) should
 * defer their work directly with `queueMicrotask`.
 */

const queue: Array<() => void> = [];

/**
 * Drains the queued post-commit work. Called by the host config's
 * `resetAfterCommit` hook, before `unfreeze()`, so the drained work still
 * benefits from FFI batching.
 *
 * The drain is reentrant: work that schedules more work during its own
 * execution is appended and processed in the same pass.
 */
export function drainAfterCommit(): void {
    while (queue.length > 0) {
        const fn = queue.shift();
        if (fn) fn();
    }
}

/**
 * Queues `fn` to run at the end of the current commit.
 */
export function scheduleAfterCommit(fn: () => void): void {
    queue.push(fn);
}
