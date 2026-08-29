import { getOrInsert } from "@gtkx/utils";
import { decodePartAt, encodePart } from "./keys.js";

type SlotKey = {
    levelPath: string;
    slot: number;
};

type SlotMap = Map<string, Set<number>>;

function getLevelBoundary(path: string): number {
    let offset = 0;
    let boundary = 0;

    while (offset < path.length) {
        const part = decodePartAt(path, offset);

        if (part === null) {
            return boundary;
        }

        boundary = offset;
        offset += encodePart(part).length;
    }

    return boundary;
}

function getSlotKey(path: string): SlotKey | null {
    const boundary = getLevelBoundary(path);
    const part = decodePartAt(path, boundary);

    if (part === null) {
        return null;
    }

    return { levelPath: path.slice(0, boundary), slot: Number(part) };
}

function trackPath(slots: SlotMap, path: string): void {
    const key = getSlotKey(path);

    if (key === null) {
        return;
    }

    getOrInsert(slots, key.levelPath, () => new Set()).add(key.slot);
}

function trackPaths(paths: Iterable<string>): SlotMap {
    const slots: SlotMap = new Map();

    for (const path of paths) {
        trackPath(slots, path);
    }

    return slots;
}

export { getSlotKey, trackPath, trackPaths, type SlotMap };
