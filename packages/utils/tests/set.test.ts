import { drain } from "@gtkx/utils";
import { describe, expect, it, vi } from "vitest";

describe("drain", () => {
    it("visits every item and clears the set", () => {
        const set = new Set(["alpha", "beta", "gamma"]);
        const visited: string[] = [];

        drain(set, (item) => {
            visited.push(item);
        });

        expect(visited).toEqual(["alpha", "beta", "gamma"]);
        expect(set.size).toBe(0);
    });

    it("handles an empty set", () => {
        const set: Set<string> = new Set();
        const visit = vi.fn();
        drain(set, visit);
        expect(visit).not.toHaveBeenCalled();
        expect(set.size).toBe(0);
    });

    it("verifies items are visited before the set is cleared", () => {
        const set = new Set([1, 2]);
        const sizesDuringVisit: number[] = [];

        drain(set, () => {
            sizesDuringVisit.push(set.size);
        });

        expect(sizesDuringVisit).toEqual([2, 2]);
        expect(set.size).toBe(0);
    });
});
