import { uniqBy } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("uniqBy", () => {
    it("deduplicates items using the key mapper and retains first occurrences", () => {
        const items = [
            { id: 1, name: "first 1" },
            { id: 2, name: "first 2" },
            { id: 1, name: "second 1" },
            { id: 3, name: "first 3" },
            { id: 2, name: "second 2" },
        ];

        const result = uniqBy(items, (item) => item.id);
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({ id: 1, name: "first 1" });
        expect(result[1]).toEqual({ id: 2, name: "first 2" });
        expect(result[2]).toEqual({ id: 3, name: "first 3" });
    });

    it("keeps all elements if all keys are unique", () => {
        const numbers = [10, 20, 30];
        const result = uniqBy(numbers, (n) => n);
        expect(result).toHaveLength(3);
        expect(result[0]).toBe(10);
        expect(result[1]).toBe(20);
        expect(result[2]).toBe(30);
    });

    it("passes item, index, and array to the mapper callback", () => {
        const recorded: [string, number, string[]][] = [];
        const arr = ["a", "b", "c"];

        uniqBy(arr, (item, index, array) => {
            recorded.push([item, index, array]);

            return item;
        });

        expect(recorded).toEqual([
            ["a", 0, arr],
            ["b", 1, arr],
            ["c", 2, arr],
        ]);
    });

    it("handles empty arrays", () => {
        const result = uniqBy([], (item: string) => item);
        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });
});
