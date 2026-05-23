import { GtkLabel } from "@gtkx/react";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { filterableIds } from "../helpers/filterable-items.js";
import { renderGridView, renderListView } from "../helpers/list-fixtures.js";
import { getChildTexts } from "../helpers/widget-text.js";

describe("render - ListView (1)", () => {
    describe("GtkListView", () => {
        it("creates ListView widget", async () => {
            const { ref } = await renderListView([{ id: "1", value: { name: "First" } }]);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListItem (1)", () => {
        it("adds item to list model", async () => {
            await renderListView([
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
            ]);

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("inserts item before existing item", async () => {
            const { rerender } = await renderListView([
                { id: "1", value: { name: "First" } },
                { id: "3", value: { name: "Third" } },
            ]);

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);

            await rerender([
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
                { id: "3", value: { name: "Third" } },
            ]);

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });
    });
});

describe("render - ListView (2)", () => {
    describe("ListItem (2)", () => {
        it("removes item from list model", async () => {
            const { rerender } = await renderListView([
                { id: "1", value: { name: "A" } },
                { id: "2", value: { name: "B" } },
                { id: "3", value: { name: "C" } },
            ]);

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(1);
            expect(screen.queryAllByText("C")).toHaveLength(1);

            await rerender([
                { id: "1", value: { name: "A" } },
                { id: "3", value: { name: "C" } },
            ]);

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(0);
            expect(screen.queryAllByText("C")).toHaveLength(1);
        });

        it("updates item value", async () => {
            const { rerender } = await renderListView([{ id: "1", value: { name: "Initial" } }]);

            expect(screen.queryAllByText("Initial")).toHaveLength(1);

            await rerender([{ id: "1", value: { name: "Updated" } }]);

            expect(screen.queryAllByText("Updated")).toHaveLength(1);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });

        it("re-renders bound items when value changes", async () => {
            const { rerender } = await renderListView([{ id: "1", value: { name: "Initial" } }]);

            expect(screen.queryAllByText("Initial")).toHaveLength(1);

            await rerender([{ id: "1", value: { name: "Updated" } }]);

            expect(screen.queryAllByText("Updated")).toHaveLength(1);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });
    });
});

describe("render - ListView (3)", () => {
    describe("renderItem", () => {
        it("receives item data in renderItem", async () => {
            const renderItem = vi.fn((item: { name: string }) => <GtkLabel label={item.name} />);

            await renderListView([{ id: "1", value: { name: "Test Item" } }], { renderItem });

            expect(renderItem).toHaveBeenCalledWith({ name: "Test Item" });
        });

        it("updates when renderItem function changes", async () => {
            const { rerender } = await renderListView([{ id: "1", value: { name: "Test" } }], {
                renderItem: (item) => <GtkLabel label={`First: ${item.name}`} />,
            });

            await rerender([{ id: "1", value: { name: "Test" } }], {
                renderItem: (item) => <GtkLabel label={`Second: ${item.name}`} />,
            });

            expect(screen.queryAllByText("Second: Test")).toHaveLength(1);
        });
    });

    describe("GtkGridView", () => {
        it("creates GridView widget", async () => {
            const { ref } = await renderGridView([{ id: "1", value: { name: "First" } }]);

            expect(ref.current).not.toBeNull();
        });

        it("sets singleClickActivate property correctly", async () => {
            const { ref } = await renderGridView([{ id: "1", value: { name: "First" } }], {
                singleClickActivate: true,
            });

            expect(ref.current?.getSingleClickActivate()).toBe(true);
        });
    });
});

describe("render - ListView (4)", () => {
    describe("item reordering (1)", () => {
        it("respects React declaration order on initial render", async () => {
            const { ref } = await renderListView(["C", "A", "B"]);

            expect(getChildTexts(ref.current)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D", "E"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D", "E"]);

            await rerender(["E", "D", "C", "B", "A"]);
            expect(getChildTexts(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["B", "D", "A", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C"]);

            await rerender(["D", "B", "E"]);
            expect(getChildTexts(ref.current)).toEqual(["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            const { ref, rerender } = await renderListView(["B", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["B", "C"]);

            await rerender(["A", "B", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            const { ref, rerender } = await renderListView(["A"]);
            expect(getChildTexts(ref.current)).toEqual(["A"]);

            await rerender(["X", "A", "Y"]);
            expect(getChildTexts(ref.current)).toEqual(["X", "A", "Y"]);
        });
    });
});

describe("render - ListView (5)", () => {
    describe("item reordering (2)", () => {
        it("handles rapid reordering", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C"]);
            await rerender(["C", "A", "B"]);
            await rerender(["B", "C", "A"]);
            await rerender(["A", "B", "C"]);

            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C"]);
        });

        it("handles large dataset reordering (200 items)", { timeout: 15000 }, async () => {
            const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
            const reversedItems = [...initialItems].reverse();

            const { ref, rerender } = await renderListView(initialItems);
            const visibleBefore = getChildTexts(ref.current);
            expect(visibleBefore.length).toBeGreaterThan(0);
            expect(visibleBefore[0]).toBe("1");

            await rerender(reversedItems);
            const visibleAfter = getChildTexts(ref.current);
            expect(visibleAfter.length).toBeGreaterThan(0);
            expect(visibleAfter[0]).toBe("200");
        });

        it("handles move first item to last position", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["B", "C", "D", "A"]);
            expect(getChildTexts(ref.current)).toEqual(["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["D", "A", "B", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            const { ref, rerender } = await renderListView(["A", "B", "C", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["A", "C", "B", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "C", "B", "D"]);
        });
    });
});

describe("render - ListView (6)", () => {
    describe("item reordering (3)", () => {
        it("handles filtered view reordering", async () => {
            const { ref, rerender } = await renderListView(filterableIds("all"));
            expect(getChildTexts(ref.current)).toEqual(["1", "2", "3", "4", "5"]);

            await rerender(filterableIds("active"));
            expect(getChildTexts(ref.current)).toEqual(["1", "3", "5"]);

            await rerender(filterableIds("inactive"));
            expect(getChildTexts(ref.current)).toEqual(["2", "4"]);

            await rerender(filterableIds("all"));
            expect(getChildTexts(ref.current)).toEqual(["1", "2", "3", "4", "5"]);
        });

        it("preserves order when only item values change", async () => {
            const { ref, rerender } = await renderListView([
                { id: "1", value: { name: "Alice" } },
                { id: "2", value: { name: "Bob" } },
                { id: "3", value: { name: "Charlie" } },
            ]);
            expect(getChildTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);

            await rerender([
                { id: "1", value: { name: "Alice Updated" } },
                { id: "2", value: { name: "Bob Updated" } },
                { id: "3", value: { name: "Charlie Updated" } },
            ]);
            expect(getChildTexts(ref.current)).toEqual(["Alice Updated", "Bob Updated", "Charlie Updated"]);
        });
    });
});

describe("render - ListView (7)", () => {
    describe("item reordering (4)", () => {
        it("preserves order when updating a single item value", async () => {
            type Item = { name: string; count: number };
            const renderItem = (item: Item) => <GtkLabel label={`${item.name}: ${item.count}`} />;

            const { ref, rerender } = await renderListView(
                [
                    { id: "1", value: { name: "Counter A", count: 0 } },
                    { id: "2", value: { name: "Counter B", count: 0 } },
                    { id: "3", value: { name: "Counter C", count: 0 } },
                ],
                { renderItem },
            );
            expect(getChildTexts(ref.current)).toEqual(["Counter A: 0", "Counter B: 0", "Counter C: 0"]);

            await rerender(
                [
                    { id: "1", value: { name: "Counter A", count: 0 } },
                    { id: "2", value: { name: "Counter B", count: 5 } },
                    { id: "3", value: { name: "Counter C", count: 0 } },
                ],
                { renderItem },
            );
            expect(getChildTexts(ref.current)).toEqual(["Counter A: 0", "Counter B: 5", "Counter C: 0"]);
        });

        it("preserves order with frequent value updates", async () => {
            type Item = { count: number };
            const renderItem = (item: Item) => <GtkLabel label={String(item.count)} />;
            const itemsFor = (a: number, b: number, c: number) => [
                { id: "1", value: { count: a } },
                { id: "2", value: { count: b } },
                { id: "3", value: { count: c } },
            ];

            const { ref, rerender } = await renderListView(itemsFor(0, 0, 0), { renderItem });
            expect(getChildTexts(ref.current)).toEqual(["0", "0", "0"]);

            for (let i = 1; i <= 10; i++) {
                await rerender(itemsFor(i, i * 2, i * 3), { renderItem });
                expect(getChildTexts(ref.current)).toEqual([String(i), String(i * 2), String(i * 3)]);
            }
        });
    });
});

describe("render - ListView (8)", () => {
    describe("GridView item reordering", () => {
        it("handles complete reversal of items", async () => {
            const { ref, rerender } = await renderGridView(["A", "B", "C", "D", "E"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D", "E"]);

            await rerender(["E", "D", "C", "B", "A"]);
            expect(getChildTexts(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const { ref, rerender } = await renderGridView(["A", "B", "C", "D"]);
            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["B", "D", "A", "C"]);
            expect(getChildTexts(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid reordering", async () => {
            const { ref, rerender } = await renderGridView(["A", "B", "C"]);
            await rerender(["C", "A", "B"]);
            await rerender(["B", "C", "A"]);
            await rerender(["A", "B", "C"]);

            expect(getChildTexts(ref.current)).toEqual(["A", "B", "C"]);
        });
    });
});
