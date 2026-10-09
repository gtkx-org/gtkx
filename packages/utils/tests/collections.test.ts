import {
    drain,
    getParentClass,
    indexBeforeOrEnd,
    isDeepEqual,
    isRecord,
    omit,
    remove,
    sortStrings,
    sortStringsBy,
    uniqBy,
    walkClassChain,
} from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("collections", () => {
    it("finds the insertion position or appends when the anchor is absent", () => {
        const items = [{ id: "a" }, { id: "b" }];
        const matches = (item: { id: string }, id: string): boolean => item.id === id;
        expect(indexBeforeOrEnd(items, "b", matches)).toBe(1);
        expect(indexBeforeOrEnd(items, "missing", matches)).toBe(2);
        expect(indexBeforeOrEnd(items, null, matches)).toBe(2);
    });

    it("removes only the first matching item", () => {
        const items = [1, 2, 1];
        remove(items, 1);
        remove(items, 9);
        expect(items).toEqual([2, 1]);
    });

    it("sorts iterable strings without mutating the source", () => {
        const input = ["z", "a", "b"];
        expect(sortStrings(input)).toEqual(["a", "b", "z"]);
        expect(input).toEqual(["z", "a", "b"]);
        expect(sortStringsBy(new Set([{ name: "z" }, { name: "a" }]), (item) => item.name)).toEqual([
            { name: "a" },
            { name: "z" },
        ]);
    });

    it("passes the source and index to uniqueness selectors", () => {
        const input = ["a", "b", "c", "d"];
        expect(uniqBy(input, (_item, index, source) => index % (source.length / 2))).toEqual(["a", "b"]);
    });

    it("drains a set including entries queued during visitation", () => {
        const items = new Set([1, 2]);
        const visited: number[] = [];
        drain(items, (item) => {
            visited.push(item);
            if (item === 1) items.add(3);
        });
        expect(visited).toEqual([1, 2, 3]);
        expect(items.size).toBe(0);
    });

    it("omits keys without mutating the input", () => {
        const input = { first: 1, second: 2 };
        expect(omit(input, ["first"])).toEqual({ second: 2 });
        expect(input).toEqual({ first: 1, second: 2 });
    });
});

describe("identity and classes", () => {
    it("compares nested data structurally and class instances by identity", () => {
        const instance = new Date(0);
        expect(isDeepEqual({ values: [1, { ok: true }], instance }, { values: [1, { ok: true }], instance })).toBe(
            true,
        );
        expect(isDeepEqual({ instance }, { instance: new Date(0) })).toBe(false);
        expect(isDeepEqual([1, 2], [2, 1])).toBe(false);
    });

    it.each([
        [null, false],
        [undefined, false],
        ["text", false],
        [{}, true],
        [[], true],
    ])("recognizes record-like values %j", (value, result) => {
        expect(isRecord(value)).toBe(result);
    });

    it("walks derived classes until the visitor resolves a value", () => {
        class Base {}
        class Child extends Base {}
        expect(getParentClass(Child)).toBe(Base);
        expect(getParentClass(Base)).toBeNull();
        const visited: string[] = [];
        expect(
            walkClassChain(Child, (cls) => {
                visited.push(cls.name);
                return cls === Base ? "found" : undefined;
            }),
        ).toBe("found");
        expect(visited).toEqual(["Child", "Base"]);
        expect(walkClassChain(null, () => "unused")).toBeUndefined();
    });
});
