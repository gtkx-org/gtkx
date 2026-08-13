import { describe, expect, it } from "vitest";
import { createCollectionIndex } from "../src/internal/collection-index.js";
import { expandedPathsFor } from "../src/internal/tree-order.js";
import { chainIds, deepChain, mutuallyReferentialItems } from "./helpers/deep-trees.js";

const CHAIN_DEPTH = 12_000;

describe("controlled expansion - resolving ids over deep and cyclic sources", () => {
    it("resolves one expanded path per expandable level of a chain deeper than the call stack", () => {
        const index = createCollectionIndex(deepChain(CHAIN_DEPTH), undefined, false);
        const paths = expandedPathsFor(index, new Set(chainIds(CHAIN_DEPTH)));
        expect(paths.size).toBe(CHAIN_DEPTH - 1);
    });

    it("stops where a cyclic source repeats an item already expanded above it", () => {
        const index = createCollectionIndex(mutuallyReferentialItems(), undefined, false);
        const paths = expandedPathsFor(index, new Set(["a", "b"]));
        expect(paths.size).toBe(2);
    });
});
