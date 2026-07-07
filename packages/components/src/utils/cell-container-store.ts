import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

export type CellEntry = {
    position: number;
    treeRow: Gtk.TreeListRow | null;
};

let nextKey = 0;

export class CellContainerStore {
    private entries = new Map<GObject.Object, CellEntry>();

    private published = new Map<GObject.Object, CellEntry>();

    private setListeners = new Set<() => void>();

    private positionListeners = new Map<GObject.Object, Set<() => void>>();

    private positionFlushers = new Map<GObject.Object, () => void>();

    private keys = new WeakMap<GObject.Object, string>();

    private snapshot: GObject.Object[] = [];

    subscribeSet = (onChange: () => void): (() => void) => {
        this.setListeners.add(onChange);
        return () => {
            this.setListeners.delete(onChange);
        };
    };

    getContainersSnapshot = (): GObject.Object[] => this.snapshot;

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

    getPosition = (container: GObject.Object): CellEntry => {
        let entry = this.published.get(container);
        if (entry === undefined) {
            entry = { position: -1, treeRow: null };
            this.published.set(container, entry);
        }
        return entry;
    };

    keyFor = (container: GObject.Object): string => {
        const existing = this.keys.get(container);
        if (existing !== undefined) return existing;
        const key = `cell-${nextKey++}`;
        this.keys.set(container, key);
        return key;
    };

    addContainer = (container: GObject.Object): void => {
        if (this.entries.has(container)) return;
        this.entries.set(container, { position: -1, treeRow: null });
        this.notifySet();
    };

    bind = (container: GObject.Object, position: number, treeRow: Gtk.TreeListRow | null): void => {
        this.entries.set(container, { position, treeRow });
        this.notifyPosition(container);
    };

    unbind = (container: GObject.Object): void => {
        if (!this.entries.has(container)) return;
        this.entries.set(container, { position: -1, treeRow: null });
        this.notifyPosition(container);
    };

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
