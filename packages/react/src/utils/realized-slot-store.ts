import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

/**
 * The realized-state of a single container managed by a factory.
 *
 * A container is realized between `setup` and `teardown`. While realized it may be bound to a
 * position (between `bind` and `unbind`) or unbound (`position === -1`). The entry object identity
 * is replaced whenever the container is rebound so that a per-container `useSyncExternalStore`
 * snapshot flips for that container alone.
 */
export interface SlotEntry {
    container: GObject.Object;
    position: number;
    treeRow: Gtk.TreeListRow | null;
    /** The container's bound model item, captured at `bind` so the resolver needs no native read during render. */
    item: GObject.Object | null;
}

let nextKey = 0;

/**
 * The external store backing the realized slots of one `Gtk.SignalListItemFactory`.
 *
 * It tracks two independent change axes. The structural set — which containers are currently
 * realized — is exposed through `subscribeSet`/`getSlotsSnapshot` with a version-stable array so
 * the portal host re-maps only when a container is added or removed. The per-container position
 * slice is exposed through `subscribePosition`/`getPosition` so a single `bind` notifies exactly
 * one container's listeners, giving the "one bind = one portal" guarantee.
 *
 * Writers run synchronously inside the factory's signal handlers. The structural snapshot
 * `getSlotsSnapshot` exposes is *published*, not live: it returns a cached array recomputed only
 * when {@link flushSet} runs — immediately, as a container is added or removed — so
 * `useSyncExternalStore` reads a version-stable reference until the realized set actually changes
 * rather than a fresh array on every read. Per-container position entries are published the same
 * way (in {@link notifyPosition}), giving `getPosition` the same referential stability between
 * rebinds.
 */
export class RealizedSlotStore {
    private entries = new Map<GObject.Object, SlotEntry>();

    private published = new Map<GObject.Object, SlotEntry>();

    private setListeners = new Set<() => void>();

    private positionListeners = new Map<GObject.Object, Set<() => void>>();

    private positionFlushers = new Map<GObject.Object, () => void>();

    private keys = new WeakMap<GObject.Object, string>();

    private snapshot: GObject.Object[] = [];

    /**
     * Subscribes to changes in the set of realized containers.
     *
     * @param onChange - Invoked synchronously whenever a container is added or removed.
     * @returns A function that removes the subscription.
     */
    subscribeSet = (onChange: () => void): (() => void) => {
        this.setListeners.add(onChange);
        return () => {
            this.setListeners.delete(onChange);
        };
    };

    /**
     * Returns the last *published* set of realized containers.
     *
     * The array identity is stable until {@link flushSet} republishes it, so the value is constant
     * across a render and its post-commit re-check even as containers realize during that commit.
     *
     * @returns The realized containers as of the last render-safe flush, in insertion order.
     */
    getSlotsSnapshot = (): GObject.Object[] => this.snapshot;

    /**
     * Subscribes to bind/unbind changes for a single container.
     *
     * @param container - The realized container whose position slice to watch.
     * @param onChange - Invoked synchronously when this container is bound or unbound.
     * @returns A function that removes the subscription.
     */
    subscribePosition = (container: GObject.Object, onChange: () => void): (() => void) => {
        let listeners = this.positionListeners.get(container);
        if (listeners === undefined) {
            listeners = new Set();
            this.positionListeners.set(container, listeners);
        }
        listeners.add(onChange);
        return () => {
            const current = this.positionListeners.get(container);
            if (current === undefined) return;
            current.delete(onChange);
            if (current.size === 0) this.positionListeners.delete(container);
        };
    };

    /**
     * Returns the last *published* entry for a container, with a stable identity until
     * {@link notifyPosition} republishes it.
     *
     * @param container - The realized container to read.
     * @returns The container's published entry; a stable unbound placeholder until first bind.
     */
    getPosition = (container: GObject.Object): SlotEntry => {
        let entry = this.published.get(container);
        if (entry === undefined) {
            entry = { container, position: -1, treeRow: null, item: null };
            this.published.set(container, entry);
        }
        return entry;
    };

    /**
     * Returns a stable React key for a container, assigned on first use.
     *
     * @param container - The container to key.
     * @returns A process-unique key string that persists across bind/unbind cycles.
     */
    keyFor = (container: GObject.Object): string => {
        const existing = this.keys.get(container);
        if (existing !== undefined) return existing;
        const key = `slot-${nextKey++}`;
        this.keys.set(container, key);
        return key;
    };

    /**
     * Records a container as realized but not yet bound, and notifies set subscribers.
     *
     * @param container - The container created by the factory's `setup` signal.
     */
    addContainer = (container: GObject.Object): void => {
        if (this.entries.has(container)) return;
        this.entries.set(container, { container, position: -1, treeRow: null, item: null });
        this.notifySet();
    };

    /**
     * Binds a container to a position and notifies only that container's subscribers.
     *
     * @param container - The container being bound by the factory's `bind` signal.
     * @param position - The logical position the container now displays.
     * @param treeRow - The tree row backing this position, or `null` outside tree mode.
     */
    bind = (
        container: GObject.Object,
        position: number,
        treeRow: Gtk.TreeListRow | null,
        item: GObject.Object | null,
    ): void => {
        if (!this.entries.has(container)) {
            this.entries.set(container, { container, position, treeRow, item });
            this.notifySet();
            return;
        }
        this.entries.set(container, { container, position, treeRow, item });
        this.notifyPosition(container);
    };

    /**
     * Marks a container as unbound and notifies only that container's subscribers.
     *
     * @param container - The container being unbound by the factory's `unbind` signal.
     */
    unbind = (container: GObject.Object): void => {
        if (!this.entries.has(container)) return;
        this.entries.set(container, { container, position: -1, treeRow: null, item: null });
        this.notifyPosition(container);
    };

    /**
     * Removes a realized container and notifies set subscribers.
     *
     * @param container - The container destroyed by the factory's `teardown` signal.
     */
    removeContainer = (container: GObject.Object): void => {
        if (!this.entries.delete(container)) return;
        this.published.delete(container);
        this.positionFlushers.delete(container);
        this.notifySet();
    };

    private flushSet = (): void => {
        this.snapshot = [...this.entries.keys()];
        for (const listener of [...this.setListeners]) listener();
    };

    private notifySet(): void {
        this.flushSet();
    }

    private notifyPosition(container: GObject.Object): void {
        let flush = this.positionFlushers.get(container);
        if (flush === undefined) {
            flush = (): void => {
                const live = this.entries.get(container);
                if (live !== undefined) this.published.set(container, live);
                const listeners = this.positionListeners.get(container);
                if (listeners === undefined) return;
                for (const listener of [...listeners]) listener();
            };
            this.positionFlushers.set(container, flush);
        }
        flush();
    }
}
