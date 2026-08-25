import { indexBeforeOrEnd, remove, sortStrings, sortStringsBy } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("indexBeforeOrEnd", () => {
    type Item = { id: string; name: string };

    const items: Item[] = [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
        { id: "c", name: "Gamma" },
    ];

    it("returns index of matching item", () => {
        const index = indexBeforeOrEnd(items, "b", (item, before) => item.id === before);
        expect(index).toBe(1);
    });

    it("returns 0 when matching the first item", () => {
        const index = indexBeforeOrEnd(items, "a", (item, before) => item.id === before);
        expect(index).toBe(0);
    });

    it("returns list length when before is null", () => {
        const index = indexBeforeOrEnd<Item, string>(items, null, (item, before) => item.id === before);
        expect(index).toBe(3);
    });

    it("returns list length when no match is found", () => {
        const index = indexBeforeOrEnd(items, "z", (item, before) => item.id === before);
        expect(index).toBe(3);
    });

    it("handles empty arrays", () => {
        const emptyList: string[] = [];
        const index = indexBeforeOrEnd(emptyList, "a", (item, before) => item === before);
        expect(index).toBe(0);
    });
});

describe("remove", () => {
    it("removes an existing element in place", () => {
        const arr = ["a", "b", "c"];
        remove(arr, "b");
        expect(arr).toEqual(["a", "c"]);
    });

    it("does nothing if the item is not found", () => {
        const arr = ["a", "b", "c"];
        remove(arr, "z");
        expect(arr).toEqual(["a", "b", "c"]);
    });

    it("removes only the first occurrence when duplicates exist", () => {
        const arr = [1, 2, 3, 2, 4];
        remove(arr, 2);
        expect(arr).toEqual([1, 3, 2, 4]);
    });

    it("removes the first element correctly", () => {
        const arr = ["first", "second"];
        remove(arr, "first");
        expect(arr).toEqual(["second"]);
    });

    it("removes the last element correctly", () => {
        const arr = ["first", "second"];
        remove(arr, "second");
        expect(arr).toEqual(["first"]);
    });

    it("handles empty arrays", () => {
        const arr: string[] = [];
        remove(arr, "anything");
        expect(arr).toEqual([]);
    });
});

describe("sortStrings", () => {
    it("sorts an array of strings in alphabetical order", () => {
        const input = ["banana", "apple", "cherry"];
        const result = sortStrings(input);
        expect(result).toEqual(["apple", "banana", "cherry"]);
    });

    it("accepts any Iterable such as a Set", () => {
        const set = new Set(["delta", "alpha", "charlie", "bravo"]);
        const result = sortStrings(set);
        expect(result).toEqual(["alpha", "bravo", "charlie", "delta"]);
    });

    it("returns a new array and does not mutate the input array", () => {
        const input = ["c", "a", "b"];
        const result = sortStrings(input);
        expect(result).toEqual(["a", "b", "c"]);
        expect(input).toEqual(["c", "a", "b"]);
        expect(result).not.toBe(input);
    });

    it("handles empty iterables", () => {
        expect(sortStrings([])).toEqual([]);
        expect(sortStrings(new Set())).toEqual([]);
    });
});

describe("sortStringsBy", () => {
    it("sorts items by the key extractor function", () => {
        const items = [
            { name: "Charlie", rank: 3 },
            { name: "Alice", rank: 1 },
            { name: "Bob", rank: 2 },
        ];

        const result = sortStringsBy(items, (item) => item.name);
        expect(result.map((i) => i.name)).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("returns a new array and does not mutate the input", () => {
        const items = [{ id: "b" }, { id: "a" }];
        const result = sortStringsBy(items, (item) => item.id);
        expect(result).toEqual([{ id: "a" }, { id: "b" }]);
        expect(items).toEqual([{ id: "b" }, { id: "a" }]);
        expect(result).not.toBe(items);
    });

    it("handles empty iterables", () => {
        expect(sortStringsBy([], (x: string) => x)).toEqual([]);
    });
});
