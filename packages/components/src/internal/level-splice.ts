import { joinParts } from "./keys.js";

type Splice = {
    start: number;
    removed: number;
    added: number;
};

type KeyAt = (slot: number) => string;

type LevelKeys = {
    previousLength: number;
    nextLength: number;
    previousKey: KeyAt;
    nextKey: KeyAt;
};

type Relocate = (slot: number) => number | undefined;

const NO_MOVES: Map<number, number> = new Map();
const NO_SPLICE: Splice = { start: 0, removed: 0, added: 0 };
const MOVE_SEARCH_LIMIT = 1024;

function findSplice(keys: LevelKeys): Splice {
    const { previousLength, nextLength, previousKey, nextKey } = keys;
    const overlap = Math.min(previousLength, nextLength);
    let start = 0;

    while (start < overlap && previousKey(start) === nextKey(start)) {
        start += 1;
    }

    let shared = 0;

    while (shared < overlap - start && previousKey(previousLength - 1 - shared) === nextKey(nextLength - 1 - shared)) {
        shared += 1;
    }

    return { start, removed: previousLength - start - shared, added: nextLength - start - shared };
}

function hasSplice(splice: Splice): boolean {
    return splice.removed > 0 || splice.added > 0;
}

function isRemoved(splice: Splice, slot: number): boolean {
    return slot >= splice.start && slot < splice.start + splice.removed;
}

function occurrenceKeys(key: KeyAt, from: number, length: number, wanted: Set<string>): Map<number, string> {
    const counts: Map<string, number> = new Map();
    const keys: Map<number, string> = new Map();

    for (let slot = from; slot < from + length; slot++) {
        const id = key(slot);

        if (!wanted.has(id)) {
            continue;
        }

        const occurrence = counts.get(id) ?? 0;
        counts.set(id, occurrence + 1);
        keys.set(slot, joinParts([id, String(occurrence)]));
    }

    return keys;
}

function matchMoves(keys: LevelKeys, splice: Splice, candidates: Iterable<number>): Map<number, number> {
    const removed = Iterator.from(candidates)
        .filter((slot) => isRemoved(splice, slot))
        .toArray();

    if (removed.length === 0 || splice.added === 0) {
        return NO_MOVES;
    }

    const wanted = new Set(removed.map((slot) => keys.previousKey(slot)));
    const previous = occurrenceKeys(keys.previousKey, splice.start, splice.removed, wanted);
    const bySlotKey: Map<string, number> = new Map();

    for (const slot of removed) {
        const key = previous.get(slot);

        if (key !== undefined) {
            bySlotKey.set(key, slot);
        }
    }

    const moves: Map<number, number> = new Map();

    for (const [slot, key] of occurrenceKeys(keys.nextKey, splice.start, splice.added, wanted)) {
        const origin = bySlotKey.get(key);

        if (origin !== undefined) {
            moves.set(origin, slot);
        }
    }

    return moves;
}

function relocateSlot(splice: Splice, slot: number, moves: Map<number, number> = NO_MOVES): number | undefined {
    if (slot < splice.start) {
        return slot;
    }

    if (isRemoved(splice, slot)) {
        return moves.get(slot);
    }

    return slot + splice.added - splice.removed;
}

function relocateEntries<V>(entries: Map<number, V>, relocate: Relocate, onDrop: (value: V) => void): Map<number, V> {
    const relocated: Map<number, V> = new Map();

    for (const [slot, value] of entries) {
        const next = relocate(slot);

        if (next === undefined) {
            onDrop(value);
        } else {
            relocated.set(next, value);
        }
    }

    return relocated;
}

/**
 * GTK looks up every added item for a moved row whenever a splice removes a row it tracks, such as the scroll
 * anchor or the focus, which makes every lazily created item real. Past a limit, the overlapping slots are
 * rewritten in place instead and only the difference is spliced, so rows that move there remount.
 */
function searchableSplice(splice: Splice, addedRows: number): Splice {
    if (addedRows <= MOVE_SEARCH_LIMIT) {
        return splice;
    }

    const rewritten = Math.min(splice.removed, splice.added);

    return { start: splice.start + rewritten, removed: splice.removed - rewritten, added: splice.added - rewritten };
}

export {
    NO_SPLICE,
    findSplice,
    hasSplice,
    matchMoves,
    relocateEntries,
    relocateSlot,
    searchableSplice,
    type LevelKeys,
    type Relocate,
    type Splice,
};
