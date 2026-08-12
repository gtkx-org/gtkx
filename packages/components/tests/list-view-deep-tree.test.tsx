import type { ListItem } from "@gtkx/components";
import { describe, expect, it } from "vitest";
import type { TreeName } from "./helpers/tree-fixtures.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { expectRowTexts, rowTexts } from "./helpers/row-texts.js";

const CHAIN_DEPTH = 8000;

const node = (id: string): ListItem<TreeName> => ({ id, value: { name: id } });

const deepChain = (depth: number): ListItem<TreeName>[] => {
    let deepest = node(`n${String(depth - 1)}`);

    for (let level = depth - 2; level >= 0; level -= 1) {
        deepest = { ...node(`n${String(level)}`), children: [deepest] };
    }

    return [deepest];
};

const selfReferentialItems = (): ListItem<TreeName>[] => {
    const loop = node("loop");
    loop.children = [loop];

    return [loop];
};

const mutuallyReferentialItems = (): ListItem<TreeName>[] => {
    const first = node("a");
    const second = node("b");
    first.children = [second];
    second.children = [first];

    return [first];
};

describe("render - ListView (tree) - collapsed deep and cyclic sources", () => {
    it("draws one row for a chain deeper than the call stack", async () => {
        const { ref } = await renderListView<TreeName>(deepChain(CHAIN_DEPTH), { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["n0"]);
    });

    it("draws one row for an item that is its own child", async () => {
        const { ref } = await renderListView<TreeName>(selfReferentialItems(), { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["loop"]);
    });

    it("draws one row for two items that reference each other", async () => {
        const { ref } = await renderListView<TreeName>(mutuallyReferentialItems(), { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["a"]);
    });

    it("expands a cyclic item one level at a time", async () => {
        const { ref } = await renderListView<TreeName>(selfReferentialItems(), { expandedIds: ["loop"] });
        await expectRowTexts(ref, ["loop", "loop"]);
    });

    it("expands the head of a deep chain without drawing the whole chain", async () => {
        const { ref } = await renderListView<TreeName>(deepChain(CHAIN_DEPTH), { expandedIds: ["n0"] });
        await expectRowTexts(ref, ["n0", "n1"]);
    });
});
