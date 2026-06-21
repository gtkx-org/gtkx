import type * as GObject from "@gtkx/gi/gobject";
import { stableIdOf } from "./stable-id.js";

export const UNBOUND_POSITION = -1;

type BoundContainerRecord = { position: number; key: string };

/**
 * A live registry of factory-created containers, each paired with its current
 * bind position and a stable identity key.
 *
 * The position and key of a container are a single concept: they are only ever
 * created, mutated, iterated, and discarded together as one container's
 * bookkeeping. This class owns that pairing behind one API so list factories
 * never thread two parallel maps.
 */
export class BoundContainerRegistry<C extends GObject.Object> {
    private records = new Map<C, BoundContainerRecord>();

    /**
     * Records a newly created container with an unbound position, assigning it
     * a stable identity key.
     */
    public register(container: C): void {
        this.records.set(container, { position: UNBOUND_POSITION, key: stableIdOf(container) });
    }

    /**
     * Updates the current bind position of an already-registered container.
     */
    public setPosition(container: C, position: number): void {
        const record = this.records.get(container);
        if (record) record.position = position;
    }

    /**
     * Removes a container from the registry.
     */
    public delete(container: C): void {
        this.records.delete(container);
    }

    /**
     * Discards every container in the registry.
     */
    public clear(): void {
        this.records.clear();
    }

    /**
     * Iterates over each registered container with its current position and
     * stable identity key.
     */
    public *entries(): IterableIterator<{ container: C; position: number; key: string }> {
        for (const [container, record] of this.records) {
            yield { container, position: record.position, key: record.key };
        }
    }
}
