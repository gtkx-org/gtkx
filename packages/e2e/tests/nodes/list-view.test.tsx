import type * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkGridView, GtkLabel, GtkListView, GtkScrolledWindow } from "@gtkx/react";
import { cleanup, render, screen, tick, userEvent } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getVisibleItemTexts } from "../helpers/get-visible-item-texts.js";

const ScrollWrapper = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

describe("render - ListView", () => {
    describe("GtkListView", () => {
        it("creates ListView widget", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[{ id: "1", value: { name: "First" } }]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListItem", () => {
        it("adds item to list model", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("inserts item before existing item", async () => {
            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });

        it("removes item from list model", async () => {
            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "2", name: "B" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(1);
            expect(screen.queryAllByText("C")).toHaveLength(1);

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(0);
            expect(screen.queryAllByText("C")).toHaveLength(1);
        });

        it("updates item value", async () => {
            function App({ itemName }: { itemName: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: itemName } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App itemName="Initial" />);

            expect(screen.queryAllByText("Initial")).toHaveLength(1);

            await render(<App itemName="Updated" />);

            expect(screen.queryAllByText("Updated")).toHaveLength(1);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });

        it("re-renders bound items when value changes", async () => {
            function App({ itemName }: { itemName: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: itemName } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App itemName="Initial" />);

            expect(screen.queryAllByText("Initial")).toHaveLength(1);

            await render(<App itemName="Updated" />);

            expect(screen.queryAllByText("Updated")).toHaveLength(1);
            expect(screen.queryAllByText("Initial")).toHaveLength(0);
        });
    });

    describe("renderItem", () => {
        it("receives item data in renderItem", async () => {
            const renderItem = vi.fn((item: { name: string }) => <GtkLabel label={item.name} />);

            await render(
                <ScrollWrapper>
                    <GtkListView items={[{ id: "1", value: { name: "Test Item" } }]} renderItem={renderItem} />
                </ScrollWrapper>,
            );

            expect(renderItem).toHaveBeenCalledWith({ name: "Test Item" });
        });

        it("updates when renderItem function changes", async () => {
            function App({ prefix }: { prefix: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: "Test" } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={`${prefix}: ${item.name}`} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App prefix="First" />);

            await render(<App prefix="Second" />);

            expect(screen.queryAllByText("Second: Test")).toHaveLength(1);
        });
    });

    describe("selection - single", () => {
        it("sets selected item via selected prop", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selected={["2"]}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, 0);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
        });

        it("selects correct item after scrolling to bottom of large list", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();
            const items = Array.from({ length: 100 }, (_, i) => ({
                id: `item-${i}`,
                name: `Item ${i}`,
            }));

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={items.map((item) => ({ id: item.id, value: item }))}
                        renderItem={(item: { id: string; name: string }) => <GtkLabel label={item.name} />}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            const listView = ref.current as Gtk.ListView;
            listView.scrollTo(99, Gtk.ListScrollFlags.NONE);
            await tick();
            await tick();

            await userEvent.selectOptions(listView, 99);

            expect(onSelectionChanged).toHaveBeenCalledWith(["item-99"]);
        });

        it("handles unselect (empty selection)", async () => {
            function App({ selected }: { selected: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: "First" } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                            selected={selected}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App selected={["1"]} />);

            await render(<App selected={[]} />);

            expect(screen.queryAllByText("First")).toHaveLength(1);
        });
    });

    describe("selection - multiple", () => {
        it("enables multi-select with selectionMode", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("sets multiple selected items", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                            { id: "3", value: { name: "Third" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        selected={["1", "3"]}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, [0, 1]);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1", "2"]);
        });
    });

    describe("GtkGridView", () => {
        it("creates GridView widget", async () => {
            const ref = createRef<Gtk.GridView>();

            await render(
                <ScrollWrapper>
                    <GtkGridView
                        ref={ref}
                        items={[{ id: "1", value: { name: "First" } }]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("sets singleClickActivate property correctly", async () => {
            const ref = createRef<Gtk.GridView>();

            await render(
                <ScrollWrapper>
                    <GtkGridView
                        ref={ref}
                        items={[{ id: "1", value: { name: "First" } }]}
                        renderItem={() => <GtkLabel label="Item" />}
                        singleClickActivate
                    />
                </ScrollWrapper>,
            );

            expect(ref.current?.getSingleClickActivate()).toBe(true);
        });
    });

    describe("item reordering", () => {
        afterEach(async () => {
            await cleanup();
        });

        it("respects React declaration order on initial render", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            { id: "c", value: { name: "C" } },
                            { id: "a", value: { name: "A" } },
                            { id: "b", value: { name: "B" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["B", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["B", "C"]);

            await render(<App items={["A", "B", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A"]);

            await render(<App items={["X", "A", "Y"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["X", "A", "Y"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });

        it("handles large dataset reordering (200 items)", { timeout: 15000 }, async () => {
            const ref = createRef<Gtk.ListView>();

            const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
            const reversedItems = [...initialItems].reverse();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={initialItems} />);
            const visibleBefore = getVisibleItemTexts(ref.current as Gtk.ListView);
            expect(visibleBefore.length).toBeGreaterThan(0);
            expect(visibleBefore[0]).toBe("1");

            await render(<App items={reversedItems} />);
            const visibleAfter = getVisibleItemTexts(ref.current as Gtk.ListView);
            expect(visibleAfter.length).toBeGreaterThan(0);
            expect(visibleAfter[0]).toBe("200");
        });

        it("handles move first item to last position", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "C", "D", "A"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["D", "A", "B", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["A", "C", "B", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "C", "B", "D"]);
        });

        it("handles filtered view reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; active: boolean };

            function App({ filter, items }: { filter: "all" | "active" | "inactive"; items: Item[] }) {
                const filteredItems = items.filter((item) => {
                    if (filter === "active") return item.active;
                    if (filter === "inactive") return !item.active;
                    return true;
                });

                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={filteredItems.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: Item) => <GtkLabel label={item.id} />}
                        />
                    </ScrollWrapper>
                );
            }

            const items: Item[] = [
                { id: "1", active: true },
                { id: "2", active: false },
                { id: "3", active: true },
                { id: "4", active: false },
                { id: "5", active: true },
            ];

            await render(<App filter="all" items={items} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["1", "2", "3", "4", "5"]);

            await render(<App filter="active" items={items} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["1", "3", "5"]);

            await render(<App filter="inactive" items={items} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["2", "4"]);

            await render(<App filter="all" items={items} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["1", "2", "3", "4", "5"]);
        });

        it("preserves order when only item values change", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; name: string };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
                { id: "3", name: "Charlie" },
            ];

            await render(<App items={initialItems} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Alice", "Bob", "Charlie"]);

            const updatedItems: Item[] = [
                { id: "1", name: "Alice Updated" },
                { id: "2", name: "Bob Updated" },
                { id: "3", name: "Charlie Updated" },
            ];

            await render(<App items={updatedItems} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Alice Updated",
                "Bob Updated",
                "Charlie Updated",
            ]);
        });

        it("preserves order when updating a single item value", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; name: string; count: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: Item) => <GtkLabel label={`${item.name}: ${item.count}`} />}
                        />
                    </ScrollWrapper>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 0 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={initialItems} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Counter A: 0",
                "Counter B: 0",
                "Counter C: 0",
            ]);

            const updatedItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 5 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={updatedItems} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Counter A: 0",
                "Counter B: 5",
                "Counter C: 0",
            ]);
        });

        it("preserves order with frequent value updates", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; value: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: Item) => <GtkLabel label={String(item.value)} />}
                        />
                    </ScrollWrapper>
                );
            }

            const baseItems: Item[] = [
                { id: "1", value: 0 },
                { id: "2", value: 0 },
                { id: "3", value: 0 },
            ];

            await render(<App items={baseItems} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["0", "0", "0"]);

            for (let i = 1; i <= 10; i++) {
                const updatedItems: Item[] = [
                    { id: "1", value: i },
                    { id: "2", value: i * 2 },
                    { id: "3", value: i * 3 },
                ];
                await render(<App items={updatedItems} />);
                expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                    String(i),
                    String(i * 2),
                    String(i * 3),
                ]);
            }
        });
    });

    describe("GridView item reordering", () => {
        afterEach(async () => {
            await cleanup();
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkGridView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.GridView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.GridView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkGridView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.GridView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.GridView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkGridView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getVisibleItemTexts(ref.current as Gtk.GridView)).toEqual(["A", "B", "C"]);
        });
    });
});

describe("render - ListView (tree)", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("GtkListView (tree)", () => {
        it("creates ListView widget with tree items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[{ id: "1", value: { name: "First" } }]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListItem (tree)", () => {
        it("adds item to tree model", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("supports nested tree items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                children: [
                                    { id: "child1", value: { name: "Child 1" } },
                                    { id: "child2", value: { name: "Child 2" } },
                                ],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });

        it("removes item from tree model", async () => {
            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={items.map((item) => ({ id: item.id, value: item }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "2", name: "B" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(1);
            expect(screen.queryAllByText("C")).toHaveLength(1);

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(0);
            expect(screen.queryAllByText("C")).toHaveLength(1);
        });

        it("updates item value", async () => {
            function App({ itemName }: { itemName: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: itemName } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App itemName="Initial" />);

            await render(<App itemName="Updated" />);

            expect(screen.queryAllByText("Updated")).toHaveLength(1);
        });
    });

    describe("renderItem (tree)", () => {
        it("receives item data in renderItem", async () => {
            const renderItem = vi.fn((item: { name: string }) => <GtkLabel label={item.name} />);

            await render(
                <ScrollWrapper>
                    <GtkListView items={[{ id: "1", value: { name: "Test Item" } }]} renderItem={renderItem} />
                </ScrollWrapper>,
            );

            expect(renderItem).toHaveBeenCalled();
        });

        it("receives TreeListRow in renderItem", async () => {
            const renderItem = vi.fn((item: { name: string }, row?: Gtk.TreeListRow | null) => (
                <GtkLabel label={`${item.name} - depth: ${row?.getDepth() ?? 0}`} />
            ));

            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                children: [{ id: "child", value: { name: "Child" } }],
                            },
                        ]}
                        renderItem={renderItem}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("Parent - depth: 0")).toHaveLength(1);
        });

        it("updates when renderItem function changes", async () => {
            function App({ prefix }: { prefix: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: "Test" } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={`${prefix}: ${item.name}`} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App prefix="First" />);

            await render(<App prefix="Second" />);

            expect(screen.queryAllByText("Second: Test")).toHaveLength(1);
        });
    });

    describe("autoexpand", () => {
        it("sets autoexpand property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                children: [{ id: "child", value: { name: "Child" } }],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("shows children in model when autoexpand is true", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                children: [
                                    { id: "child1", value: { name: "Child 1" } },
                                    { id: "child2", value: { name: "Child 2" } },
                                ],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Parent", "Child 1", "Child 2"]);
        });

        it("parent row is expandable when it has children", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                children: [{ id: "child1", value: { name: "Child 1" } }],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            const treeExpanders = screen
                .queryAllByRole(Gtk.AccessibleRole.BUTTON)
                .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander);
            expect(treeExpanders.length).toBeGreaterThan(0);

            const expander = treeExpanders[0] as Gtk.TreeExpander;
            const row = expander.getListRow();
            expect(row).not.toBeNull();
            expect(row?.isExpandable()).toBe(true);
        });

        it("expands parent row to show children when expanded", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                children: [
                                    { id: "child1", value: { name: "Child 1" } },
                                    { id: "child2", value: { name: "Child 2" } },
                                ],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Parent"]);

            const treeExpanders = screen
                .queryAllByRole(Gtk.AccessibleRole.BUTTON)
                .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander);
            const expander = treeExpanders[0] as Gtk.TreeExpander;
            const row = expander.getListRow();
            if (!row) throw new Error("Expected row to exist");
            row.setExpanded(true);
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Parent", "Child 1", "Child 2"]);
        });

        it("updates autoexpand property", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ autoexpand }: { autoexpand: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={[
                                {
                                    id: "parent",
                                    value: { name: "Parent" },
                                    children: [{ id: "child", value: { name: "Child" } }],
                                },
                            ]}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                            autoexpand={autoexpand}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App autoexpand={false} />);

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Parent"]);

            await render(<App autoexpand={true} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("selection - single (tree)", () => {
        it("sets selected item via selected prop", async () => {
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selected={["2"]}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            await tick();

            expect(onSelectionChanged).toHaveBeenCalledWith(["2"]);
        });

        it("sets initial selection on first render", async () => {
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "first", value: { name: "First" } },
                            { id: "second", value: { name: "Second" } },
                            { id: "third", value: { name: "Third" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selected={["first"]}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            expect(onSelectionChanged).toHaveBeenCalledWith(["first"]);
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, 0);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
        });

        it("handles unselect (empty selection)", async () => {
            function App({ selected }: { selected: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            items={[{ id: "1", value: { name: "First" } }]}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                            selected={selected}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App selected={["1"]} />);

            await render(<App selected={[]} />);

            expect(screen.queryAllByText("First")).toHaveLength(1);
        });

        it("selects correct child item after scrolling to bottom of expanded tree", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();
            const groups = Array.from({ length: 20 }, (_, gi) => ({
                id: `group-${gi}`,
                name: `Group ${gi}`,
                children: Array.from({ length: 5 }, (_, ci) => ({
                    id: `group-${gi}-child-${ci}`,
                    name: `Group ${gi} Child ${ci}`,
                })),
            }));

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        autoexpand
                        items={groups.map((group) => ({
                            id: group.id,
                            value: group,
                            children: group.children.map((child) => ({
                                id: child.id,
                                value: child,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            await tick();

            const listView = ref.current as Gtk.ListView;
            const model = listView.getModel() as Gio.ListModel;
            const lastPosition = model.getNItems() - 1;
            listView.scrollTo(lastPosition, Gtk.ListScrollFlags.NONE);
            await tick();
            await tick();

            await userEvent.selectOptions(listView, lastPosition);

            expect(onSelectionChanged).toHaveBeenCalledWith(["group-19-child-4"]);
        });

        it("preserves tree state and scroll position when selecting after scrolling down", async () => {
            const ref = createRef<Gtk.ListView>();
            const scrollRef = createRef<Gtk.ScrolledWindow>();

            interface Item {
                id: string;
                name: string;
                children?: Item[];
            }

            const data: Item[] = [
                { id: "intro", name: "Introduction" },
                ...Array.from({ length: 20 }, (_, gi) => ({
                    id: `cat-${gi}`,
                    name: `Category ${gi}`,
                    children: Array.from({ length: 5 }, (_, ci) => ({
                        id: `cat-${gi}-demo-${ci}`,
                        name: `Cat ${gi} Demo ${ci}`,
                    })),
                })),
            ];

            function toListItems(items: Item[]) {
                return items.map((item) => ({
                    id: item.id,
                    value: item,
                    hideExpander: !item.children,
                    children: item.children?.map((child) => ({
                        id: child.id,
                        value: child,
                        hideExpander: true,
                    })),
                }));
            }

            function Sidebar({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
                return (
                    <GtkScrolledWindow
                        ref={scrollRef}
                        minContentHeight={200}
                        maxContentHeight={200}
                        minContentWidth={200}
                    >
                        <GtkListView
                            ref={ref}
                            cssClasses={["navigation-sidebar"]}
                            autoexpand
                            selectionMode={Gtk.SelectionMode.SINGLE}
                            items={toListItems(data)}
                            selected={selectedId ? [selectedId] : []}
                            onSelectionChanged={(ids: string[]) => {
                                const id = ids[0];
                                if (id) onSelect(id);
                            }}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </GtkScrolledWindow>
                );
            }

            function App() {
                const [selectedId, setSelectedId] = useState<string | null>("intro");
                const selectedItem = data.flatMap((d) => [d, ...(d.children ?? [])]).find((d) => d.id === selectedId);

                return (
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
                        <Sidebar selectedId={selectedId} onSelect={setSelectedId} />
                        <GtkLabel label={selectedItem?.name ?? "None"} vexpand hexpand />
                    </GtkBox>
                );
            }

            await render(<App />);
            await tick();

            const listView = ref.current as Gtk.ListView;
            const selectionModel = listView.getModel() as Gtk.SingleSelection;
            const totalItems = selectionModel.getNItems();

            const targetPosition = totalItems - 1;
            const scrolledWindow = scrollRef.current as Gtk.ScrolledWindow;
            const vadj = scrolledWindow.getVadjustment();

            listView.scrollTo(targetPosition, Gtk.ListScrollFlags.FOCUS);
            await tick();
            await tick();
            await tick();

            if (vadj.getValue() === 0 && vadj.getUpper() > vadj.getPageSize()) {
                vadj.setValue(vadj.getUpper() - vadj.getPageSize());
                await tick();
                await tick();
            }

            const scrollPosBefore = vadj.getValue();
            expect(scrollPosBefore).toBeGreaterThan(0);

            await userEvent.selectOptions(listView, targetPosition);
            await tick();
            await tick();
            await tick();
            await tick();
            await tick();

            expect(selectionModel.getSelected()).toBe(targetPosition);

            const scrollPosAfter = vadj.getValue();
            expect(scrollPosAfter).toBe(scrollPosBefore);
        });
    });

    describe("selection - multiple (tree)", () => {
        it("enables multi-select with selectionMode", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("sets multiple selected items", async () => {
            await render(
                <ScrollWrapper>
                    <GtkListView
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                            { id: "3", value: { name: "Third" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        selected={["1", "3"]}
                    />
                </ScrollWrapper>,
            );

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            { id: "1", value: { name: "First" } },
                            { id: "2", value: { name: "Second" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        onSelectionChanged={onSelectionChanged}
                    />
                </ScrollWrapper>,
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, [0, 1]);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1", "2"]);
        });
    });

    describe("item reordering (tree)", () => {
        it("respects React declaration order on initial render", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            { id: "c", value: { name: "C" } },
                            { id: "a", value: { name: "A" } },
                            { id: "b", value: { name: "B" } },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["D", "B", "E"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            items={items.map((id) => ({ id, value: { name: id } }))}
                            renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });
    });

    describe("nested children rendering", () => {
        it("renders all nested children with correct data after expansion", async () => {
            const ref = createRef<Gtk.ListView>();

            interface Category {
                type: "category";
                id: string;
                name: string;
            }

            interface Setting {
                type: "setting";
                id: string;
                name: string;
            }

            type TreeItem = Category | Setting;

            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Animations" },
                        { type: "setting", id: "transparency", name: "Transparency" },
                    ],
                },
                {
                    type: "category",
                    id: "notifications",
                    name: "Notifications",
                    children: [
                        { type: "setting", id: "notifications-enabled", name: "Alerts" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
                {
                    type: "category",
                    id: "privacy",
                    name: "Privacy",
                    children: [
                        { type: "setting", id: "location", name: "Location Services" },
                        { type: "setting", id: "camera", name: "Camera Access" },
                        { type: "setting", id: "microphone", name: "Microphone Access" },
                        { type: "setting", id: "analytics", name: "Usage Analytics" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={categories.map((category) => ({
                            id: category.id,
                            value: category as TreeItem,
                            children: category.children.map((setting) => ({
                                id: setting.id,
                                value: setting as TreeItem,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: TreeItem) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Appearance",
                "Notifications",
                "Privacy",
            ]);

            const treeExpanders = screen
                .queryAllByRole(Gtk.AccessibleRole.BUTTON)
                .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander)
                .filter((w) => w.getListRow()?.isExpandable());

            const notificationsExpander = treeExpanders[1] as Gtk.TreeExpander;
            const row = notificationsExpander.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);
            await tick();
            await tick();
            await tick();

            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Appearance",
                "Notifications",
                "Alerts",
                "Notification Sounds",
                "Do Not Disturb",
                "Show Badge Count",
                "Privacy",
            ]);
        });

        it("renders all children with correct data when using autoexpand", async () => {
            const ref = createRef<Gtk.ListView>();

            interface Category {
                type: "category";
                id: string;
                name: string;
            }

            interface Setting {
                type: "setting";
                id: string;
                name: string;
            }

            type TreeItem = Category | Setting;

            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "notifications",
                    name: "Notifications",
                    children: [
                        { type: "setting", id: "notifications-enabled", name: "Alerts" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        autoexpand
                        items={categories.map((category) => ({
                            id: category.id,
                            value: category as TreeItem,
                            children: category.children.map((setting) => ({
                                id: setting.id,
                                value: setting as TreeItem,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: TreeItem) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            await tick();
            await tick();
            await tick();

            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Notifications",
                "Alerts",
                "Notification Sounds",
                "Do Not Disturb",
                "Show Badge Count",
            ]);
        });
    });

    describe("tree item properties", () => {
        it("supports indentForDepth property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                indentForDepth: false,
                                children: [{ id: "child", value: { name: "Child" }, indentForDepth: true }],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports indentForIcon property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                indentForIcon: true,
                                children: [{ id: "child", value: { name: "Child" }, indentForIcon: false }],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports hideExpander property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={[
                            {
                                id: "parent",
                                value: { name: "Parent" },
                                hideExpander: false,
                                children: [{ id: "child", value: { name: "Child" }, hideExpander: true }],
                            },
                        ]}
                        renderItem={(item: { name: string }) => <GtkLabel label={item.name} />}
                        autoexpand
                    />
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("settings tree regression", () => {
        it("renders all children with non-null values on first expansion", async () => {
            const ref = createRef<Gtk.ListView>();

            interface Category {
                type: "category";
                id: string;
                name: string;
            }

            interface Setting {
                type: "setting";
                id: string;
                name: string;
            }

            type TreeItem = Category | Setting;

            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Enable Animations" },
                        { type: "setting", id: "transparency", name: "Transparency Effects" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={categories.map((category) => ({
                            id: category.id,
                            value: category as TreeItem,
                            children: category.children.map((setting) => ({
                                id: setting.id,
                                value: setting as TreeItem,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: TreeItem) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            const treeExpanders = screen
                .queryAllByRole(Gtk.AccessibleRole.BUTTON)
                .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander);
            const expander = treeExpanders[0] as Gtk.TreeExpander;
            const row = expander.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);
            await tick();
            await tick();
            await tick();

            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Appearance",
                "Dark Mode",
                "Large Text",
                "Enable Animations",
                "Transparency Effects",
            ]);
        });

        it("renders all children with non-null values when clicking TreeExpander", async () => {
            const ref = createRef<Gtk.ListView>();

            interface Category {
                type: "category";
                id: string;
                name: string;
            }

            interface Setting {
                type: "setting";
                id: string;
                name: string;
            }

            type TreeItem = Category | Setting;

            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Enable Animations" },
                        { type: "setting", id: "transparency", name: "Transparency Effects" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={categories.map((category) => ({
                            id: category.id,
                            value: category as TreeItem,
                            children: category.children.map((setting) => ({
                                id: setting.id,
                                value: setting as TreeItem,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: TreeItem) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            const buttons = screen.queryAllByRole(Gtk.AccessibleRole.BUTTON);
            const treeExpanders = buttons.filter((btn) => btn instanceof Gtk.TreeExpander);
            expect(treeExpanders.length).toBeGreaterThan(0);

            const expander = treeExpanders[0] as Gtk.TreeExpander;
            const row = expander.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Appearance",
                "Dark Mode",
                "Large Text",
                "Enable Animations",
                "Transparency Effects",
            ]);
        });

        it("renders all children correctly after multiple expand/collapse cycles", async () => {
            const ref = createRef<Gtk.ListView>();

            interface Category {
                type: "category";
                id: string;
                name: string;
            }

            interface Setting {
                type: "setting";
                id: string;
                name: string;
            }

            type TreeItem = Category | Setting;

            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Enable Animations" },
                        { type: "setting", id: "transparency", name: "Transparency Effects" },
                    ],
                },
                {
                    type: "category",
                    id: "notifications",
                    name: "Notifications",
                    children: [
                        { type: "setting", id: "notifications-enabled", name: "Alerts" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
                {
                    type: "category",
                    id: "privacy",
                    name: "Privacy",
                    children: [
                        { type: "setting", id: "location", name: "Location Services" },
                        { type: "setting", id: "camera", name: "Camera Access" },
                        { type: "setting", id: "microphone", name: "Microphone Access" },
                        { type: "setting", id: "analytics", name: "Usage Analytics" },
                    ],
                },
                {
                    type: "category",
                    id: "power",
                    name: "Power",
                    children: [
                        { type: "setting", id: "auto-brightness", name: "Auto Brightness" },
                        { type: "setting", id: "power-saver", name: "Power Saver Mode" },
                        { type: "setting", id: "screen-timeout", name: "Screen Timeout" },
                        { type: "setting", id: "auto-suspend", name: "Automatic Suspend" },
                    ],
                },
                {
                    type: "category",
                    id: "network",
                    name: "Network",
                    children: [
                        { type: "setting", id: "wifi", name: "Wi-Fi" },
                        { type: "setting", id: "bluetooth", name: "Bluetooth" },
                        { type: "setting", id: "airplane", name: "Airplane Mode" },
                        { type: "setting", id: "vpn", name: "VPN" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        items={categories.map((category) => ({
                            id: category.id,
                            value: category as TreeItem,
                            children: category.children.map((setting) => ({
                                id: setting.id,
                                value: setting as TreeItem,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: TreeItem) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Appearance",
                "Notifications",
                "Privacy",
                "Power",
                "Network",
            ]);

            const getExpandableExpanders = () =>
                screen
                    .queryAllByRole(Gtk.AccessibleRole.BUTTON)
                    .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander)
                    .filter((w) => w.getListRow()?.isExpandable());

            const expandAndVerify = async (categoryIndex: number, expectedChildren: string[]) => {
                const expanders = getExpandableExpanders();
                const expander = expanders[categoryIndex] as Gtk.TreeExpander;
                const row = expander.getListRow();
                if (!row) throw new Error("Expected row to exist");
                row.setExpanded(true);
                await tick();
                await tick();
                await tick();

                expect(screen.queryAllByText("Loading...")).toHaveLength(0);

                for (const childName of expectedChildren) {
                    expect(screen.queryAllByText(childName)).toHaveLength(1);
                }
            };

            const collapseRow = async (categoryIndex: number) => {
                const expanders = getExpandableExpanders();
                const expander = expanders[categoryIndex] as Gtk.TreeExpander;
                const row = expander.getListRow();
                if (!row) throw new Error("Expected row to exist");
                row.setExpanded(false);
                await tick();
            };

            await expandAndVerify(0, ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"]);

            await collapseRow(0);
            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Appearance",
                "Notifications",
                "Privacy",
                "Power",
                "Network",
            ]);

            await expandAndVerify(0, ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"]);

            await collapseRow(0);

            await expandAndVerify(1, ["Alerts", "Notification Sounds", "Do Not Disturb", "Show Badge Count"]);

            await collapseRow(1);

            await expandAndVerify(0, ["Dark Mode", "Large Text", "Enable Animations", "Transparency Effects"]);

            expect(screen.queryAllByText("Loading...")).toHaveLength(0);
        });

        it("third child does not remain stuck on Loading after expansion", async () => {
            const ref = createRef<Gtk.ListView>();

            interface Category {
                type: "category";
                id: string;
                name: string;
            }

            interface Setting {
                type: "setting";
                id: string;
                name: string;
            }

            type TreeItem = Category | Setting;

            const categories: Array<Category & { children: Setting[] }> = [
                {
                    type: "category",
                    id: "appearance",
                    name: "Appearance",
                    children: [
                        { type: "setting", id: "dark-mode", name: "Dark Mode" },
                        { type: "setting", id: "large-text", name: "Large Text" },
                        { type: "setting", id: "animations", name: "Enable Animations" },
                        { type: "setting", id: "transparency", name: "Transparency Effects" },
                    ],
                },
                {
                    type: "category",
                    id: "notifications",
                    name: "Notifications",
                    children: [
                        { type: "setting", id: "notifications-enabled", name: "Alerts" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        estimatedItemHeight={48}
                        items={categories.map((category) => ({
                            id: category.id,
                            value: category as TreeItem,
                            children: category.children.map((setting) => ({
                                id: setting.id,
                                value: setting as TreeItem,
                                hideExpander: true,
                            })),
                        }))}
                        renderItem={(item: TreeItem) => <GtkLabel label={item.name} />}
                    />
                </ScrollWrapper>,
            );

            const treeExpanders = screen
                .queryAllByRole(Gtk.AccessibleRole.BUTTON)
                .filter((w): w is Gtk.TreeExpander => w instanceof Gtk.TreeExpander);
            const expander = treeExpanders[0] as Gtk.TreeExpander;
            const row = expander.getListRow();
            if (!row) throw new Error("Expected row to exist");

            const assertChildrenVisible = () => {
                expect(screen.queryAllByText("Loading...")).toHaveLength(0);
                expect(screen.queryAllByText("Dark Mode")).toHaveLength(1);
                expect(screen.queryAllByText("Large Text")).toHaveLength(1);
                expect(screen.queryAllByText("Enable Animations")).toHaveLength(1);
                expect(screen.queryAllByText("Transparency Effects")).toHaveLength(1);
            };

            const assertChildrenHidden = () => {
                expect(screen.queryAllByText("Dark Mode")).toHaveLength(0);
                expect(screen.queryAllByText("Large Text")).toHaveLength(0);
                expect(screen.queryAllByText("Enable Animations")).toHaveLength(0);
                expect(screen.queryAllByText("Transparency Effects")).toHaveLength(0);
            };

            for (let i = 0; i < 3; i++) {
                row.setExpanded(true);
                await tick();
                await tick();
                await tick();
                assertChildrenVisible();

                row.setExpanded(false);
                await tick();
                await tick();
                await tick();
                assertChildrenHidden();
            }

            row.setExpanded(true);
            await tick();
            await tick();
            await tick();
            assertChildrenVisible();
        });
    });

    describe("tree filtering", () => {
        it("shows children after filtering from many root items to few", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { type: "category"; name: string } | { type: "leaf"; name: string };

            function App({
                items,
            }: {
                items: Array<{
                    id: string;
                    value: Item;
                    children?: Array<{ id: string; value: Item; hideExpander: true }>;
                }>;
            }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            autoexpand
                            items={items}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            const fullItems = [
                { id: "leaf-a", value: { type: "leaf" as const, name: "Alpha" } },
                {
                    id: "cat-b",
                    value: { type: "category" as const, name: "Bravo" },
                    children: [
                        { id: "leaf-b1", value: { type: "leaf" as const, name: "B-One" }, hideExpander: true as const },
                        { id: "leaf-b2", value: { type: "leaf" as const, name: "B-Two" }, hideExpander: true as const },
                    ],
                },
                { id: "leaf-c", value: { type: "leaf" as const, name: "Charlie" } },
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d1", value: { type: "leaf" as const, name: "D-One" }, hideExpander: true as const },
                        { id: "leaf-d2", value: { type: "leaf" as const, name: "D-Two" }, hideExpander: true as const },
                        {
                            id: "leaf-d3",
                            value: { type: "leaf" as const, name: "D-Three" },
                            hideExpander: true as const,
                        },
                    ],
                },
                { id: "leaf-e", value: { type: "leaf" as const, name: "Echo" } },
            ];

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const fullTexts = getVisibleItemTexts(ref.current as Gtk.ListView);
            expect(fullTexts).toEqual([
                "Alpha",
                "Bravo",
                "B-One",
                "B-Two",
                "Charlie",
                "Delta",
                "D-One",
                "D-Two",
                "D-Three",
                "Echo",
            ]);

            const filteredItems = [
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d2", value: { type: "leaf" as const, name: "D-Two" }, hideExpander: true as const },
                    ],
                },
            ];

            await render(<App items={filteredItems} />);
            await tick();
            await tick();
            await tick();

            const filteredTexts = getVisibleItemTexts(ref.current as Gtk.ListView);
            expect(filteredTexts).toEqual(["Delta", "D-Two"]);
        });

        it("shows children after multiple filter transitions", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { type: "category"; name: string } | { type: "leaf"; name: string };

            function App({
                items,
            }: {
                items: Array<{
                    id: string;
                    value: Item;
                    children?: Array<{ id: string; value: Item; hideExpander: true }>;
                }>;
            }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            autoexpand
                            items={items}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            const fullItems = [
                { id: "leaf-a", value: { type: "leaf" as const, name: "Alpha" } },
                {
                    id: "cat-b",
                    value: { type: "category" as const, name: "Bravo" },
                    children: [
                        { id: "leaf-b1", value: { type: "leaf" as const, name: "B-One" }, hideExpander: true as const },
                        { id: "leaf-b2", value: { type: "leaf" as const, name: "B-Two" }, hideExpander: true as const },
                    ],
                },
                { id: "leaf-c", value: { type: "leaf" as const, name: "Charlie" } },
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d1", value: { type: "leaf" as const, name: "D-One" }, hideExpander: true as const },
                        { id: "leaf-d2", value: { type: "leaf" as const, name: "D-Two" }, hideExpander: true as const },
                        {
                            id: "leaf-d3",
                            value: { type: "leaf" as const, name: "D-Three" },
                            hideExpander: true as const,
                        },
                    ],
                },
                { id: "leaf-e", value: { type: "leaf" as const, name: "Echo" } },
            ];

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const filter1 = [
                { id: "leaf-a", value: { type: "leaf" as const, name: "Alpha" } },
                {
                    id: "cat-b",
                    value: { type: "category" as const, name: "Bravo" },
                    children: [
                        { id: "leaf-b1", value: { type: "leaf" as const, name: "B-One" }, hideExpander: true as const },
                    ],
                },
            ];

            await render(<App items={filter1} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Alpha", "Bravo", "B-One"]);

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const filter2 = [
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d2", value: { type: "leaf" as const, name: "D-Two" }, hideExpander: true as const },
                    ],
                },
            ];

            await render(<App items={filter2} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Delta", "D-Two"]);
        });

        it("shows children after filtering a large tree with many root items", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { name: string };

            function App({
                items,
            }: {
                items: Array<{
                    id: string;
                    value: Item;
                    children?: Array<{ id: string; value: Item; hideExpander: true }>;
                }>;
            }) {
                return (
                    <GtkScrolledWindow minContentHeight={400} minContentWidth={200}>
                        <GtkListView
                            ref={ref}
                            autoexpand
                            items={items}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </GtkScrolledWindow>
                );
            }

            const fullItems: Array<{
                id: string;
                value: Item;
                children?: Array<{ id: string; value: Item; hideExpander: true }>;
            }> = [];
            for (let i = 0; i < 38; i++) {
                if (i % 5 === 1) {
                    fullItems.push({
                        id: `cat-${i}`,
                        value: { name: `Category ${i}` },
                        children: Array.from({ length: 3 }, (_, j) => ({
                            id: `child-${i}-${j}`,
                            value: { name: `Child ${i}-${j}` },
                            hideExpander: true as const,
                        })),
                    });
                } else {
                    fullItems.push({ id: `leaf-${i}`, value: { name: `Leaf ${i}` } });
                }
            }

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const filteredItems = [
                {
                    id: "cat-21",
                    value: { name: "Category 21" },
                    children: [{ id: "child-21-1", value: { name: "Child 21-1" }, hideExpander: true as const }],
                },
            ];

            await render(<App items={filteredItems} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Category 21", "Child 21-1"]);
        });

        it("shows children after filtering demo-like tree from 38 items to single category", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { name: string };
            type ListItems = Array<{
                id: string;
                value: Item;
                children?: Array<{ id: string; value: Item; hideExpander: true }>;
            }>;

            function App({ items }: { items: ListItems }) {
                return (
                    <GtkScrolledWindow minContentHeight={600} minContentWidth={200}>
                        <GtkListView
                            ref={ref}
                            autoexpand
                            items={items}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </GtkScrolledWindow>
                );
            }

            const leaf = (id: string, name: string) => ({ id, value: { name } });
            const cat = (
                id: string,
                name: string,
                children: Array<{ id: string; value: Item; hideExpander: true }>,
            ) => ({
                id,
                value: { name },
                children,
            });
            const child = (id: string, name: string) => ({ id, value: { name }, hideExpander: true as const });

            const fullItems: ListItems = [
                leaf("demo-intro", "GTK Demo"),
                cat("cat-Benchmark", "Benchmark", [child("demo-frames", "Frames"), child("demo-themes", "Themes")]),
                leaf("demo-clipboard", "Clipboard"),
                cat("cat-Constraints", "Constraints", [
                    child("demo-interactive", "Interactive Constraints"),
                    child("demo-simple", "Simple Constraints"),
                    child("demo-vfl", "VFL"),
                ]),
                leaf("demo-cursors", "Cursors"),
                leaf("demo-dialog", "Dialogs"),
                leaf("demo-dnd", "Drag-and-Drop"),
                leaf("demo-drawingarea", "Drawing Area"),
                cat("cat-Entry", "Entry", [
                    child("demo-password", "Password Entry"),
                    child("demo-search-entry", "Search Entry"),
                    child("demo-undo-entry", "Undo and Redo"),
                ]),
                leaf("demo-errorstates", "Error States"),
                leaf("demo-expander", "Expander"),
                cat("cat-Fixed-Layout", "Fixed Layout", [
                    child("demo-cube", "Cube"),
                    child("demo-transforms", "Transformations"),
                ]),
                leaf("demo-flowbox", "Flow Box"),
                leaf("demo-gestures", "Gestures"),
                leaf("demo-headerbar", "Header Bar"),
                leaf("demo-images", "Images"),
                leaf("demo-links", "Links"),
                cat("cat-List-Box", "List Box", [
                    child("demo-listbox-complex", "Complex"),
                    child("demo-listbox-controls", "Controls"),
                ]),
                cat("cat-Lists", "Lists", [
                    child("demo-alt-settings", "Alternative Settings"),
                    child("demo-app-launcher", "Application launcher"),
                    child("demo-characters", "Characters"),
                    child("demo-colors", "Colors"),
                    child("demo-file-browser", "File browser"),
                    child("demo-minesweeper", "Minesweeper"),
                    child("demo-selections", "Selections"),
                    child("demo-settings", "Settings"),
                    child("demo-weather", "Weather"),
                    child("demo-words", "Words"),
                ]),
                cat("cat-OpenGL", "OpenGL", [
                    child("demo-gears", "Gears"),
                    child("demo-glarea", "OpenGL Area"),
                    child("demo-shadertoy", "Shadertoy"),
                ]),
                cat("cat-Overlay", "Overlay", [
                    child("demo-decorative", "Decorative Overlay"),
                    child("demo-interactive-overlay", "Interactive Overlay"),
                ]),
                cat("cat-Paintable", "Paintable", [child("demo-svg", "SVG")]),
                leaf("demo-panes", "Paned Widgets"),
                cat("cat-Pango", "Pango", [
                    child("demo-font-explorer", "Font Explorer"),
                    child("demo-font-rendering", "Font Rendering"),
                    child("demo-rotated-text", "Rotated Text"),
                    child("demo-text-mask", "Text Mask"),
                ]),
                leaf("demo-pickers", "Pickers and Launchers"),
                cat("cat-Printing", "Printing", [
                    child("demo-page-setup", "Page Setup"),
                    child("demo-printing", "Printing"),
                ]),
                leaf("demo-revealer", "Revealer"),
                leaf("demo-scale", "Scales"),
                leaf("demo-shortcut-triggers", "Shortcut Triggers"),
                leaf("demo-shortcuts", "Shortcuts"),
                leaf("demo-sizegroup", "Size Groups"),
                leaf("demo-spinbutton", "Spin Buttons"),
                leaf("demo-spinner", "Spinner"),
                leaf("demo-stack", "Stack"),
                leaf("demo-sidebar", "Stack Sidebar"),
                cat("cat-Text-View", "Text View", [
                    child("demo-auto-scroll", "Automatic Scrolling"),
                    child("demo-hypertext", "Hypertext"),
                    child("demo-markup", "Markup"),
                    child("demo-multi-views", "Multiple Views"),
                    child("demo-tabs", "Tabs"),
                    child("demo-undo-text", "Undo and Redo"),
                ]),
                cat("cat-Theming", "Theming", [
                    child("demo-accordion", "CSS Accordion"),
                    child("demo-css-basics", "CSS Basics"),
                    child("demo-blend-modes", "CSS Blend Modes"),
                    child("demo-multi-bg", "Multiple Backgrounds"),
                    child("demo-animated-bg", "Animated Backgrounds"),
                    child("demo-shadows", "Shadows"),
                    child("demo-style-classes", "Style Classes"),
                ]),
                leaf("demo-video-player", "Video Player"),
            ];

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const weatherFilter: ListItems = [cat("cat-Lists", "Lists", [child("demo-weather", "Weather")])];

            await render(<App items={weatherFilter} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Lists", "Weather"]);
        });

        it("shows children after filtering demo-like tree with small viewport", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { name: string };
            type ListItems = Array<{
                id: string;
                value: Item;
                children?: Array<{ id: string; value: Item; hideExpander: true }>;
            }>;

            function App({ items }: { items: ListItems }) {
                return (
                    <GtkScrolledWindow minContentHeight={100} maxContentHeight={100} minContentWidth={200}>
                        <GtkListView
                            ref={ref}
                            autoexpand
                            items={items}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </GtkScrolledWindow>
                );
            }

            const leaf = (id: string, name: string) => ({ id, value: { name } });
            const cat = (
                id: string,
                name: string,
                children: Array<{ id: string; value: Item; hideExpander: true }>,
            ) => ({
                id,
                value: { name },
                children,
            });
            const ch = (id: string, name: string) => ({ id, value: { name }, hideExpander: true as const });

            const fullItems: ListItems = [];
            for (let i = 0; i < 40; i++) {
                if (i % 4 === 0) {
                    fullItems.push(
                        cat(`cat-${i}`, `Category ${i}`, [
                            ch(`ch-${i}-0`, `Child ${i}-0`),
                            ch(`ch-${i}-1`, `Child ${i}-1`),
                        ]),
                    );
                } else {
                    fullItems.push(leaf(`leaf-${i}`, `Leaf ${i}`));
                }
            }

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const filteredItems: ListItems = [cat("cat-36", "Category 36", [ch("ch-36-0", "Child 36-0")])];

            await render(<App items={filteredItems} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Category 36", "Child 36-0"]);
        });

        it("shows children when transitioning from one filter to another without restoring full list", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { type: "category"; name: string } | { type: "leaf"; name: string };

            function App({
                items,
            }: {
                items: Array<{
                    id: string;
                    value: Item;
                    children?: Array<{ id: string; value: Item; hideExpander: true }>;
                }>;
            }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            autoexpand
                            items={items}
                            renderItem={(item: Item) => <GtkLabel label={item.name} />}
                        />
                    </ScrollWrapper>
                );
            }

            const fullItems = [
                { id: "leaf-a", value: { type: "leaf" as const, name: "Alpha" } },
                {
                    id: "cat-b",
                    value: { type: "category" as const, name: "Bravo" },
                    children: [
                        { id: "leaf-b1", value: { type: "leaf" as const, name: "B-One" }, hideExpander: true as const },
                        { id: "leaf-b2", value: { type: "leaf" as const, name: "B-Two" }, hideExpander: true as const },
                    ],
                },
                { id: "leaf-c", value: { type: "leaf" as const, name: "Charlie" } },
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d1", value: { type: "leaf" as const, name: "D-One" }, hideExpander: true as const },
                        { id: "leaf-d2", value: { type: "leaf" as const, name: "D-Two" }, hideExpander: true as const },
                        {
                            id: "leaf-d3",
                            value: { type: "leaf" as const, name: "D-Three" },
                            hideExpander: true as const,
                        },
                    ],
                },
                { id: "leaf-e", value: { type: "leaf" as const, name: "Echo" } },
            ];

            await render(<App items={fullItems} />);
            await tick();
            await tick();
            await tick();

            const filter1 = [
                { id: "leaf-a", value: { type: "leaf" as const, name: "Alpha" } },
                {
                    id: "cat-b",
                    value: { type: "category" as const, name: "Bravo" },
                    children: [
                        { id: "leaf-b1", value: { type: "leaf" as const, name: "B-One" }, hideExpander: true as const },
                    ],
                },
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d1", value: { type: "leaf" as const, name: "D-One" }, hideExpander: true as const },
                    ],
                },
            ];

            await render(<App items={filter1} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual([
                "Alpha",
                "Bravo",
                "B-One",
                "Delta",
                "D-One",
            ]);

            const filter2 = [
                {
                    id: "cat-d",
                    value: { type: "category" as const, name: "Delta" },
                    children: [
                        { id: "leaf-d2", value: { type: "leaf" as const, name: "D-Two" }, hideExpander: true as const },
                    ],
                },
            ];

            await render(<App items={filter2} />);
            await tick();
            await tick();
            await tick();

            expect(getVisibleItemTexts(ref.current as Gtk.ListView)).toEqual(["Delta", "D-Two"]);
        });
    });
});
