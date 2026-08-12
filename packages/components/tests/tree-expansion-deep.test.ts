import { describe, expect, it } from "vitest";
import type { TreeExpansion } from "../src/internal/tree-expansion.js";
import { createCollectionIndex } from "../src/internal/collection-index.js";
import { encodePart } from "../src/internal/keys.js";
import { adoptOrder, createTreeExpansion, markExpanded } from "../src/internal/tree-expansion.js";

const EXPANDED_DEPTH = 12_000;

const chainPaths = (depth: number): string[] => {
    const paths: string[] = [];
    let path = encodePart("0");

    for (let level = 0; level < depth; level += 1) {
        path += encodePart("0");
        paths.push(path);
    }

    return paths;
};

const trackedSlots = (expansion: TreeExpansion): number => {
    let total = 0;

    for (const slots of expansion.slots.values()) {
        total += slots.size;
    }

    return total;
};

const deeplyExpanded = (paths: string[]): TreeExpansion => {
    const expansion = createTreeExpansion(createCollectionIndex(undefined, undefined, true));
    adoptOrder(expansion, { expandedPaths: paths, expandedIds: [] });

    return expansion;
};

describe("tree expansion - collapsing a chain expanded deeper than the call stack", () => {
    it("drops every level of the collapsed subtree", () => {
        const paths = chainPaths(EXPANDED_DEPTH);
        const [head = ""] = paths;
        const expansion = deeplyExpanded(paths);
        markExpanded(expansion, head, false);
        expect(expansion.expanded.size).toBe(0);
        expect(trackedSlots(expansion)).toBe(0);
    });
});
