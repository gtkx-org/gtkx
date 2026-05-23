import type { BoundItem } from "../nodes/internal/bound-item.js";

/**
 * Snapshot of the bound items emitted by a list/grid/column/dropdown view.
 *
 * Every mutation produces a fresh snapshot object so that
 * `useSyncExternalStore`'s `Object.is` comparison observes the change.
 */
export interface BoundItemsSnapshot {
    boundItems: BoundItem[];
    headerBoundItems: BoundItem[];
}

const EMPTY_BOUND_ITEMS: BoundItem[] = [];

/**
 * External store driving the portal collection of a list-like view.
 *
 * The host reconciler node owns the store and updates it whenever GTK's
 * factory `bind`/`unbind` signals fire or a commit mutates the model. The
 * matching React component subscribes via `useSyncExternalStore`, which
 * receives the notifications safely from outside any React commit and
 * batches them through React's own scheduler. This keeps signal-driven
 * updates inside the surrounding `act` boundary that tests await without
 * routing setState through ad-hoc `queueMicrotask` plumbing.
 */
export class BoundItemsStore {
    private snapshot: BoundItemsSnapshot = { boundItems: EMPTY_BOUND_ITEMS, headerBoundItems: EMPTY_BOUND_ITEMS };
    private readonly listeners = new Set<() => void>();

    /** Returns the current snapshot. Stable until the next mutation. */
    public readonly getSnapshot = (): BoundItemsSnapshot => this.snapshot;

    /** Subscribes a listener; returns an unsubscribe function. */
    public readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** Replaces the bound items list and notifies subscribers. */
    public setBoundItems(items: BoundItem[]): void {
        this.snapshot = { boundItems: items, headerBoundItems: this.snapshot.headerBoundItems };
        this.notify();
    }

    /** Replaces the header bound items list and notifies subscribers. */
    public setHeaderBoundItems(items: BoundItem[]): void {
        this.snapshot = { boundItems: this.snapshot.boundItems, headerBoundItems: items };
        this.notify();
    }

    private notify(): void {
        for (const listener of this.listeners) listener();
    }
}
