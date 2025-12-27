import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGridView, GtkLabel, GtkListView, ListItem } from "@gtkx/react";
import { cleanup, render, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getModelItemCount = (listView: Gtk.ListView): number => {
    const model = listView.getModel();
    if (!model) return 0;
    return model.getNItems() ?? 0;
};

const getModelItemOrder = (listView: Gtk.ListView | Gtk.GridView): string[] => {
    const selectionModel = listView.getModel();
    if (!selectionModel) return [];

    const ids: string[] = [];
    const nItems = selectionModel.getNItems();
    for (let i = 0; i < nItems; i++) {
        const item = selectionModel.getObject(i) as Gtk.StringObject | null;
        if (item) {
            ids.push(item.getString());
        }
    }
    return ids;
};

describe("render - ListView", () => {
    describe("GtkListView", () => {
        it("creates ListView widget", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={ref} renderItem={() => "Item"}>
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListItem", () => {
        it("adds item to list model", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={ref} renderItem={() => "Item"}>
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "3", name: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(3);
        });

        it("removes item from list model", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
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
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(3);

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("updates item value", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ itemName }: { itemName: string }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <ListItem id="1" value={{ name: itemName }} />
                    </GtkListView>
                );
            }

            await render(<App itemName="Initial" />, { wrapper: false });

            await render(<App itemName="Updated" />, { wrapper: false });
        });
    });

    describe("renderItem", () => {
        it("receives item data in renderItem", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderItem = vi.fn((item: { name: string } | null) => <GtkLabel label={item?.name ?? "Empty"} />);

            await render(
                <GtkListView ref={ref} renderItem={renderItem}>
                    <ListItem id="1" value={{ name: "Test Item" }} />
                </GtkListView>,
                { wrapper: false },
            );
        });

        it("updates when renderItem function changes", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ prefix }: { prefix: string }) {
                return (
                    <GtkListView
                        ref={ref}
                        renderItem={(item: { name: string } | null) => (
                            <GtkLabel label={`${prefix}: ${item?.name ?? ""}`} />
                        )}
                    >
                        <ListItem id="1" value={{ name: "Test" }} />
                    </GtkListView>
                );
            }

            await render(<App prefix="First" />, { wrapper: false });

            await render(<App prefix="Second" />, { wrapper: false });
        });
    });

    describe("selection - single", () => {
        it("sets selected item via selected prop", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={ref} renderItem={() => "Item"} selected={["2"]}>
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <GtkListView ref={ref} renderItem={() => "Item"} onSelectionChanged={onSelectionChanged}>
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, 0);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
        });

        it("handles unselect (empty selection)", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ selected }: { selected: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"} selected={selected}>
                        <ListItem id="1" value={{ name: "First" }} />
                    </GtkListView>
                );
            }

            await render(<App selected={["1"]} />, { wrapper: false });

            await render(<App selected={[]} />, { wrapper: false });
        });
    });

    describe("selection - multiple", () => {
        it("enables multi-select with selectionMode", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={ref} renderItem={() => "Item"} selectionMode={Gtk.SelectionMode.MULTIPLE}>
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );
        });

        it("sets multiple selected items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView
                    ref={ref}
                    renderItem={() => "Item"}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    selected={["1", "3"]}
                >
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                    <ListItem id="3" value={{ name: "Third" }} />
                </GtkListView>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <GtkListView
                    ref={ref}
                    renderItem={() => "Item"}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    onSelectionChanged={onSelectionChanged}
                >
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, [0, 1]);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1", "2"]);
        });
    });

    describe("GtkGridView", () => {
        it("creates GridView widget", async () => {
            const ref = createRef<Gtk.GridView>();

            await render(
                <GtkGridView ref={ref} renderItem={() => "Item"}>
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkGridView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("item reordering", () => {
        afterEach(async () => {
            await cleanup();
        });

        it("respects React declaration order on initial render", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={ref} renderItem={() => "Item"}>
                    <ListItem id="c" value={{ name: "C" }} />
                    <ListItem id="a" value={{ name: "A" }} />
                    <ListItem id="b" value={{ name: "B" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["c", "a", "b"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["B", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "C"]);

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A"]);

            await render(<App items={["X", "A", "Y"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["X", "A", "Y"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            await render(<App items={["C", "A", "B"]} />, { wrapper: false });
            await render(<App items={["B", "C", "A"]} />, { wrapper: false });
            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });

        it("handles large dataset reordering (200 items)", async () => {
            const ref = createRef<Gtk.ListView>();

            const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
            const reversedItems = [...initialItems].reverse();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={initialItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(initialItems);

            await render(<App items={reversedItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(reversedItems);
        });

        it("handles move first item to last position", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "C", "D", "A"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["D", "A", "B", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkListView>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["A", "C", "B", "D"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "C", "B", "D"]);
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
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        {filteredItems.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
                );
            }

            const items: Item[] = [
                { id: "1", active: true },
                { id: "2", active: false },
                { id: "3", active: true },
                { id: "4", active: false },
                { id: "5", active: true },
            ];

            await render(<App filter="all" items={items} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3", "4", "5"]);

            await render(<App filter="active" items={items} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "3", "5"]);

            await render(<App filter="inactive" items={items} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["2", "4"]);

            await render(<App filter="all" items={items} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3", "4", "5"]);
        });

        it("preserves order when only item values change", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderCalls: Array<{ id: string; name: string }> = [];

            type Item = { id: string; name: string };

            function App({ items }: { items: Item[] }) {
                return (
                    <GtkListView
                        ref={ref}
                        renderItem={(item: Item | null) => {
                            if (item) {
                                renderCalls.push({ id: item.id, name: item.name });
                            }
                            return <GtkLabel label={item?.name ?? ""} />;
                        }}
                    >
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
                { id: "3", name: "Charlie" },
            ];

            await render(<App items={initialItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);

            renderCalls.length = 0;

            const updatedItems: Item[] = [
                { id: "1", name: "Alice Updated" },
                { id: "2", name: "Bob Updated" },
                { id: "3", name: "Charlie Updated" },
            ];

            await render(<App items={updatedItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);
        });

        it("preserves order when updating a single item value", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; name: string; count: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <GtkListView
                        ref={ref}
                        renderItem={(item: Item | null) => (
                            <GtkLabel label={`${item?.name ?? ""}: ${item?.count ?? 0}`} />
                        )}
                    >
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 0 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={initialItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);

            const updatedItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 5 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={updatedItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);
        });

        it("preserves order with frequent value updates", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; value: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <GtkListView
                        ref={ref}
                        renderItem={(item: Item | null) => <GtkLabel label={String(item?.value ?? 0)} />}
                    >
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkListView>
                );
            }

            const baseItems: Item[] = [
                { id: "1", value: 0 },
                { id: "2", value: 0 },
                { id: "3", value: 0 },
            ];

            await render(<App items={baseItems} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);

            for (let i = 1; i <= 10; i++) {
                const updatedItems: Item[] = [
                    { id: "1", value: i },
                    { id: "2", value: i * 2 },
                    { id: "3", value: i * 3 },
                ];
                await render(<App items={updatedItems} />, { wrapper: false });
                expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);
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
                    <GtkGridView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkGridView>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkGridView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkGridView>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkGridView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <ListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </GtkGridView>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            await render(<App items={["C", "A", "B"]} />, { wrapper: false });
            await render(<App items={["B", "C", "A"]} />, { wrapper: false });
            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["A", "B", "C"]);
        });
    });
});
