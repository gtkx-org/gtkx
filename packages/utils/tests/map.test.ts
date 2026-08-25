import { getOrInsert } from "@gtkx/utils";
import { describe, expect, it, vi } from "vitest";

describe("getOrInsert", () => {
    it("returns existing value when key exists without calling factory", () => {
        const map: Map<string, number> = new Map([["count", 42]]);
        const factory = vi.fn(() => 100);
        const result = getOrInsert(map, "count", factory);
        expect(result).toBe(42);
        expect(factory).not.toHaveBeenCalled();
    });

    it("inserts and returns the factory result when key is absent", () => {
        const map: Map<string, number> = new Map();
        const factory = vi.fn((key: string) => key.length);
        const result = getOrInsert(map, "hello", factory);
        expect(result).toBe(5);
        expect(factory).toHaveBeenCalledExactlyOnceWith("hello");
        expect(map.get("hello")).toBe(5);
    });

    it("subsequent calls return the cached value without invoking factory again", () => {
        const map: Map<string, { id: number }> = new Map();
        const factory = vi.fn(() => ({ id: 1 }));
        const first = getOrInsert(map, "item", factory);
        const second = getOrInsert(map, "item", factory);
        expect(first).toBe(second);
        expect(factory).toHaveBeenCalledOnce();
    });
});
