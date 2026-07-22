import { describe, expect, it, vi } from "vitest";
import { getOrInsert } from "../src/map/index.js";

describe("getOrInsert", () => {
    it("returns the existing value without calling the factory", () => {
        const map = new Map<string, number>([["a", 1]]);
        const factory = vi.fn(() => 99);
        expect(getOrInsert(map, "a", factory)).toBe(1);
        expect(factory).not.toHaveBeenCalled();
    });

    it("inserts and returns a freshly-created value on a miss", () => {
        const map = new Map<string, number[]>();
        const created = getOrInsert(map, "a", () => []);
        created.push(1);
        expect(map.get("a")).toEqual([1]);
    });

    it("passes the key to the factory", () => {
        const map = new Map<string, string>();
        expect(getOrInsert(map, "key", (key) => `v:${key}`)).toBe("v:key");
    });

    it("caches a computed undefined value instead of recomputing it", () => {
        const map = new Map<string, number | undefined>();
        const factory = vi.fn(() => undefined);
        expect(getOrInsert(map, "a", factory)).toBeUndefined();
        expect(getOrInsert(map, "a", factory)).toBeUndefined();
        expect(factory).toHaveBeenCalledTimes(1);
    });

    it("works with a WeakMap", () => {
        const map = new WeakMap<object, number>();
        const key = {};
        expect(getOrInsert(map, key, () => 5)).toBe(5);
        expect(getOrInsert(map, key, () => 9)).toBe(5);
    });
});
