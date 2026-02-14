import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGridView, GtkLabel, GtkListView, GtkScrolledWindow, x } from "@gtkx/react";
import { cleanup, render, screen, tick, userEvent } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getTreeModelItemCount = (listView: Gtk.ListView): number => {
    const model = listView.getModel();
    if (!model) return 0;
    return model.getNItems() ?? 0;
};

const getTreeModelItemOrder = (listView: Gtk.ListView): string[] => {
    const selectionModel = listView.getModel();
    if (!selectionModel) return [];

    const ids: string[] = [];
    const nItems = selectionModel.getNItems();
    for (let i = 0; i < nItems; i++) {
        const row = (selectionModel as Gtk.SingleSelection).getObject(i) as Gtk.TreeListRow | null;
        if (row) {
            const item = row.getItem() as Gtk.StringObject | null;
            if (item) {
                ids.push(item.getString());
            }
        }
    }
    return ids;
};

const ScrollWrapper = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

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
        const obj = selectionModel.getObject(i);
        const item =
            obj instanceof Gtk.TreeListRow
                ? (obj.getItem() as Gtk.StringObject | null)
                : (obj as Gtk.StringObject | null);
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
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListItem", () => {
        it("adds item to list model", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
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

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(3);
        });

        it("removes item from list model", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
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

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(3);

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("updates item value", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ itemName }: { itemName: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            <x.ListItem id="1" value={{ name: itemName }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App itemName="Initial" />);

            await render(<App itemName="Updated" />);
        });

        it("re-renders bound items when value changes", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ itemName }: { itemName: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            renderItem={(item: { name: string } | null) => <GtkLabel label={item?.name ?? "Empty"} />}
                        >
                            <x.ListItem id="1" value={{ name: itemName }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App itemName="Initial" />);

            const listView = ref.current as Gtk.ListView;
            const getFirstLabelText = (): string | null => {
                const cell = listView.getFirstChild();
                const expander = cell?.getFirstChild();
                const box = expander?.getFirstChild();
                const label = box?.getFirstChild() as Gtk.Label | null;
                return label?.getLabel() ?? null;
            };

            expect(getFirstLabelText()).toBe("Initial");

            await render(<App itemName="Updated" />);

            expect(getFirstLabelText()).toBe("Updated");
        });
    });

    describe("renderItem", () => {
        it("receives item data in renderItem", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderItem = vi.fn((item: { name: string } | null) => <GtkLabel label={item?.name ?? "Empty"} />);

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={renderItem}>
                        <x.ListItem id="1" value={{ name: "Test Item" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("updates when renderItem function changes", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ prefix }: { prefix: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            renderItem={(item: { name: string } | null) => (
                                <GtkLabel label={`${prefix}: ${item?.name ?? ""}`} />
                            )}
                        >
                            <x.ListItem id="1" value={{ name: "Test" }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App prefix="First" />);

            await render(<App prefix="Second" />);
        });
    });

    describe("selection - single", () => {
        it("sets selected item via selected prop", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} selected={["2"]}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} onSelectionChanged={onSelectionChanged}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, 0);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
        });

        it("handles unselect (empty selection)", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ selected }: { selected: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"} selected={selected}>
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App selected={["1"]} />);

            await render(<App selected={[]} />);
        });
    });

    describe("selection - multiple", () => {
        it("enables multi-select with selectionMode", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} selectionMode={Gtk.SelectionMode.MULTIPLE}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("sets multiple selected items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        renderItem={() => "Item"}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        selected={["1", "3"]}
                    >
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                        <x.ListItem id="3" value={{ name: "Third" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        renderItem={() => "Item"}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        onSelectionChanged={onSelectionChanged}
                    >
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
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
                    <GtkGridView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkGridView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("sets singleClickActivate property correctly", async () => {
            const ref = createRef<Gtk.GridView>();

            await render(
                <ScrollWrapper>
                    <GtkGridView ref={ref} renderItem={() => <GtkLabel label="Item" />} singleClickActivate>
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkGridView>
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
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="c" value={{ name: "C" }} />
                        <x.ListItem id="a" value={{ name: "A" }} />
                        <x.ListItem id="b" value={{ name: "B" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["c", "a", "b"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "C"]);

            await render(<App items={["A", "B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A"]);

            await render(<App items={["X", "A", "Y"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["X", "A", "Y"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });

        it("handles large dataset reordering (200 items)", { timeout: 15000 }, async () => {
            const ref = createRef<Gtk.ListView>();

            const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
            const reversedItems = [...initialItems].reverse();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={initialItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(initialItems);

            await render(<App items={reversedItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(reversedItems);
        });

        it("handles move first item to last position", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "C", "D", "A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["D", "A", "B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["A", "C", "B", "D"]} />);
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
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {filteredItems.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
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
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3", "4", "5"]);

            await render(<App filter="active" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "3", "5"]);

            await render(<App filter="inactive" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["2", "4"]);

            await render(<App filter="all" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3", "4", "5"]);
        });

        it("preserves order when only item values change", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderCalls: Array<{ id: string; name: string }> = [];

            type Item = { id: string; name: string };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
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
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
                { id: "3", name: "Charlie" },
            ];

            await render(<App items={initialItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);

            renderCalls.length = 0;

            const updatedItems: Item[] = [
                { id: "1", name: "Alice Updated" },
                { id: "2", name: "Bob Updated" },
                { id: "3", name: "Charlie Updated" },
            ];

            await render(<App items={updatedItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);
        });

        it("preserves order when updating a single item value", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; name: string; count: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            renderItem={(item: Item | null) => (
                                <GtkLabel label={`${item?.name ?? ""}: ${item?.count ?? 0}`} />
                            )}
                        >
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 0 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={initialItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);

            const updatedItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 5 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={updatedItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);
        });

        it("preserves order with frequent value updates", async () => {
            const ref = createRef<Gtk.ListView>();

            type Item = { id: string; value: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            renderItem={(item: Item | null) => <GtkLabel label={String(item?.value ?? 0)} />}
                        >
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            const baseItems: Item[] = [
                { id: "1", value: 0 },
                { id: "2", value: 0 },
                { id: "3", value: 0 },
            ];

            await render(<App items={baseItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["1", "2", "3"]);

            for (let i = 1; i <= 10; i++) {
                const updatedItems: Item[] = [
                    { id: "1", value: i },
                    { id: "2", value: i * 2 },
                    { id: "3", value: i * 3 },
                ];
                await render(<App items={updatedItems} />);
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
                    <ScrollWrapper>
                        <GtkGridView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkGridView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkGridView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkGridView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.GridView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkGridView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkGridView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getModelItemOrder(ref.current as Gtk.GridView)).toEqual(["A", "B", "C"]);
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
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListItem (tree)", () => {
        it("adds item to tree model", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("supports nested tree items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }}>
                            <x.ListItem id="child1" value={{ name: "Child 1" }} />
                            <x.ListItem id="child2" value={{ name: "Child 2" }} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
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

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(2);

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(3);
        });

        it("removes item from tree model", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkListView>
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

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(3);

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("updates item value", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ itemName }: { itemName: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            <x.ListItem id="1" value={{ name: itemName }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App itemName="Initial" />);

            await render(<App itemName="Updated" />);
        });
    });

    describe("renderItem (tree)", () => {
        it("receives item data in renderItem", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderItem = vi.fn((item: { name: string } | null) => <GtkLabel label={item?.name ?? "Empty"} />);

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={renderItem}>
                        <x.ListItem id="1" value={{ name: "Test Item" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("receives TreeListRow in renderItem", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderItem = vi.fn((item: { name: string } | null, row?: Gtk.TreeListRow | null) => (
                <GtkLabel label={`${item?.name ?? ""} - depth: ${row?.getDepth() ?? 0}`} />
            ));

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={renderItem} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }}>
                            <x.ListItem id="child" value={{ name: "Child" }} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("updates when renderItem function changes", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ prefix }: { prefix: string }) {
                return (
                    <ScrollWrapper>
                        <GtkListView
                            ref={ref}
                            renderItem={(item: { name: string } | null) => (
                                <GtkLabel label={`${prefix}: ${item?.name ?? ""}`} />
                            )}
                        >
                            <x.ListItem id="1" value={{ name: "Test" }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App prefix="First" />);

            await render(<App prefix="Second" />);
        });
    });

    describe("autoexpand", () => {
        it("sets autoexpand property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }}>
                            <x.ListItem id="child" value={{ name: "Child" }} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("shows children in model when autoexpand is true", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }}>
                            <x.ListItem id="child1" value={{ name: "Child 1" }} />
                            <x.ListItem id="child2" value={{ name: "Child 2" }} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(3);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["parent", "child1", "child2"]);
        });

        it("parent row is expandable when it has children", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="parent" value={{ name: "Parent" }}>
                            <x.ListItem id="child1" value={{ name: "Child 1" }} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            expect(selectionModel.getNItems()).toBeGreaterThan(0);
            const row = selectionModel.getObject(0) as Gtk.TreeListRow;
            expect(row).not.toBeNull();

            expect(row.isExpandable()).toBe(true);
        });

        it("expands parent row to show children when expanded", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="parent" value={{ name: "Parent" }}>
                            <x.ListItem id="child1" value={{ name: "Child 1" }} />
                            <x.ListItem id="child2" value={{ name: "Child 2" }} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(1);

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const row = selectionModel.getObject(0) as Gtk.TreeListRow;
            row.setExpanded(true);

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(3);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["parent", "child1", "child2"]);
        });

        it("updates autoexpand property", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ autoexpand }: { autoexpand: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"} autoexpand={autoexpand}>
                            <x.ListItem id="parent" value={{ name: "Parent" }}>
                                <x.ListItem id="child" value={{ name: "Child" }} />
                            </x.ListItem>
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App autoexpand={false} />);

            await render(<App autoexpand={true} />);
        });
    });

    describe("selection - single (tree)", () => {
        it("sets selected item via selected prop", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} selected={["2"]}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            await tick();

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const selection = selectionModel.getSelection();
            expect(selection.getSize()).toBe(1);
            expect(selection.getNth(0)).toBe(1);
        });

        it("sets initial selection on first render", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} selected={["first"]}>
                        <x.ListItem id="first" value={{ name: "First" }} />
                        <x.ListItem id="second" value={{ name: "Second" }} />
                        <x.ListItem id="third" value={{ name: "Third" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const selection = selectionModel.getSelection();
            expect(selection.getSize()).toBe(1);
            expect(selection.getNth(0)).toBe(0);
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} onSelectionChanged={onSelectionChanged}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, 0);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
        });

        it("handles unselect (empty selection)", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ selected }: { selected: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"} selected={selected}>
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App selected={["1"]} />);

            await render(<App selected={[]} />);
        });
    });

    describe("selection - multiple (tree)", () => {
        it("enables multi-select with selectionMode", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} selectionMode={Gtk.SelectionMode.MULTIPLE}>
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("sets multiple selected items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        renderItem={() => "Item"}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        selected={["1", "3"]}
                    >
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                        <x.ListItem id="3" value={{ name: "Third" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkListView
                        ref={ref}
                        renderItem={() => "Item"}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        onSelectionChanged={onSelectionChanged}
                    >
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkListView>
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
                    <GtkListView ref={ref} renderItem={() => "Item"}>
                        <x.ListItem id="c" value={{ name: "C" }} />
                        <x.ListItem id="a" value={{ name: "A" }} />
                        <x.ListItem id="b" value={{ name: "B" }} />
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["c", "a", "b"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["D", "B", "E"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkListView ref={ref} renderItem={() => "Item"}>
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkListView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });
    });

    describe("nested children rendering", () => {
        it("renders all nested children with correct data after expansion", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderedItems: Array<{ id: string; name: string } | null> = [];

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
                        { type: "setting", id: "notifications-enabled", name: "Notifications" },
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
                    <GtkListView<TreeItem>
                        ref={ref}
                        renderItem={(item) => {
                            renderedItems.push(item ? { id: item.id, name: item.name } : null);
                            if (!item) {
                                return <GtkLabel label="Loading..." />;
                            }
                            return <GtkLabel label={item.name} />;
                        }}
                    >
                        {categories.map((category) => (
                            <x.ListItem key={category.id} id={category.id} value={category as TreeItem}>
                                {category.children.map((setting) => (
                                    <x.ListItem
                                        key={setting.id}
                                        id={setting.id}
                                        value={setting as TreeItem}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(3);

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const notificationsRow = selectionModel.getObject(1) as Gtk.TreeListRow;
            expect(notificationsRow.isExpandable()).toBe(true);

            notificationsRow.setExpanded(true);
            await tick();
            await tick();
            renderedItems.length = 0;
            await tick();

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(7);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual([
                "appearance",
                "notifications",
                "notifications-enabled",
                "sounds",
                "do-not-disturb",
                "badge-count",
                "privacy",
            ]);

            const nullItems = renderedItems.filter((item) => item === null);
            expect(nullItems.length).toBe(0);
        });

        it("renders all children with correct data when using autoexpand", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderedItems: Array<{ id: string; name: string } | null> = [];

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
                        { type: "setting", id: "notifications-enabled", name: "Notifications" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView<TreeItem>
                        ref={ref}
                        autoexpand
                        renderItem={(item) => {
                            renderedItems.push(item ? { id: item.id, name: item.name } : null);
                            if (!item) {
                                return <GtkLabel label="Loading..." />;
                            }
                            return <GtkLabel label={item.name} />;
                        }}
                    >
                        {categories.map((category) => (
                            <x.ListItem key={category.id} id={category.id} value={category as TreeItem}>
                                {category.children.map((setting) => (
                                    <x.ListItem
                                        key={setting.id}
                                        id={setting.id}
                                        value={setting as TreeItem}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </ScrollWrapper>,
            );

            await tick();
            await tick();
            renderedItems.length = 0;
            await tick();

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(5);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual([
                "notifications",
                "notifications-enabled",
                "sounds",
                "do-not-disturb",
                "badge-count",
            ]);

            const nullItems = renderedItems.filter((item) => item === null);
            expect(nullItems.length).toBe(0);
        });
    });

    describe("tree item properties", () => {
        it("supports indentForDepth property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }} indentForDepth={false}>
                            <x.ListItem id="child" value={{ name: "Child" }} indentForDepth={true} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports indentForIcon property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }} indentForIcon={true}>
                            <x.ListItem id="child" value={{ name: "Child" }} indentForIcon={false} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports hideExpander property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <ScrollWrapper>
                    <GtkListView ref={ref} renderItem={() => "Item"} autoexpand>
                        <x.ListItem id="parent" value={{ name: "Parent" }} hideExpander={false}>
                            <x.ListItem id="child" value={{ name: "Child" }} hideExpander={true} />
                        </x.ListItem>
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("settings tree regression", () => {
        it("renders all children with non-null values on first expansion", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderedItems: Array<{ id: string; name: string } | null> = [];

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
                    <GtkListView<TreeItem>
                        ref={ref}
                        renderItem={(item) => {
                            renderedItems.push(item ? { id: item.id, name: item.name } : null);
                            if (!item) {
                                return <GtkLabel label="Loading..." />;
                            }
                            return <GtkLabel label={item.name} />;
                        }}
                    >
                        {categories.map((category) => (
                            <x.ListItem key={category.id} id={category.id} value={category as TreeItem}>
                                {category.children.map((setting) => (
                                    <x.ListItem
                                        key={setting.id}
                                        id={setting.id}
                                        value={setting as TreeItem}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </ScrollWrapper>,
            );

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const row = selectionModel.getObject(0) as Gtk.TreeListRow;

            row.setExpanded(true);
            await tick();
            await tick();
            renderedItems.length = 0;
            await tick();

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(5);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual([
                "appearance",
                "dark-mode",
                "large-text",
                "animations",
                "transparency",
            ]);

            const nullItems = renderedItems.filter((item) => item === null);
            expect(nullItems.length).toBe(0);
        });

        it("renders all children with non-null values when clicking TreeExpander", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderedItems: Array<{ id: string; name: string } | null> = [];

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
                    <GtkListView<TreeItem>
                        ref={ref}
                        renderItem={(item) => {
                            renderedItems.push(item ? { id: item.id, name: item.name } : null);
                            if (!item) {
                                return <GtkLabel label="Loading..." />;
                            }
                            return <GtkLabel label={item.name} />;
                        }}
                    >
                        {categories.map((category) => (
                            <x.ListItem key={category.id} id={category.id} value={category as TreeItem}>
                                {category.children.map((setting) => (
                                    <x.ListItem
                                        key={setting.id}
                                        id={setting.id}
                                        value={setting as TreeItem}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </ScrollWrapper>,
            );

            const buttons = screen.queryAllByRole(Gtk.AccessibleRole.BUTTON);
            const treeExpanders = buttons.filter((btn) => btn instanceof Gtk.TreeExpander);
            expect(treeExpanders.length).toBeGreaterThan(0);

            const expander = treeExpanders[0] as Gtk.TreeExpander;
            const row = expander.getListRow();
            if (!row) throw new Error("Expected row to exist");

            row.setExpanded(true);

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(5);
            expect(getTreeModelItemOrder(ref.current as Gtk.ListView)).toEqual([
                "appearance",
                "dark-mode",
                "large-text",
                "animations",
                "transparency",
            ]);
        });

        it("renders all children correctly after multiple expand/collapse cycles", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderedItems: Array<{ id: string; name: string } | null> = [];

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
                        { type: "setting", id: "notifications-enabled", name: "Notifications" },
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
                    <GtkListView<TreeItem>
                        ref={ref}
                        renderItem={(item) => {
                            renderedItems.push(item ? { id: item.id, name: item.name } : null);
                            if (!item) {
                                return <GtkLabel label="Loading..." />;
                            }
                            return <GtkLabel label={item.name} />;
                        }}
                    >
                        {categories.map((category) => (
                            <x.ListItem key={category.id} id={category.id} value={category as TreeItem}>
                                {category.children.map((setting) => (
                                    <x.ListItem
                                        key={setting.id}
                                        id={setting.id}
                                        value={setting as TreeItem}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </ScrollWrapper>,
            );

            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(5);

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;

            const expandAndVerify = async (categoryIndex: number, expectedChildren: string[]) => {
                const row = selectionModel.getObject(categoryIndex) as Gtk.TreeListRow;
                row.setExpanded(true);
                await tick();
                await tick();
                renderedItems.length = 0;
                await tick();

                const nullItems = renderedItems.filter((item) => item === null);
                expect(nullItems.length).toBe(0);

                const expandedOrder = getTreeModelItemOrder(ref.current as Gtk.ListView);
                for (const childId of expectedChildren) {
                    expect(expandedOrder).toContain(childId);
                }
            };

            const collapseRow = async (categoryIndex: number) => {
                const row = selectionModel.getObject(categoryIndex) as Gtk.TreeListRow;
                row.setExpanded(false);
                await tick();
            };

            await expandAndVerify(0, ["dark-mode", "large-text", "animations", "transparency"]);

            await collapseRow(0);
            expect(getTreeModelItemCount(ref.current as Gtk.ListView)).toBe(5);

            await expandAndVerify(0, ["dark-mode", "large-text", "animations", "transparency"]);

            await collapseRow(0);

            await expandAndVerify(1, ["notifications-enabled", "sounds", "do-not-disturb", "badge-count"]);

            await collapseRow(1);

            await expandAndVerify(0, ["dark-mode", "large-text", "animations", "transparency"]);

            const finalNullItems = renderedItems.filter((item) => item === null);
            expect(finalNullItems.length).toBe(0);
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
                        { type: "setting", id: "notifications-enabled", name: "Notifications" },
                        { type: "setting", id: "sounds", name: "Notification Sounds" },
                        { type: "setting", id: "do-not-disturb", name: "Do Not Disturb" },
                        { type: "setting", id: "badge-count", name: "Show Badge Count" },
                    ],
                },
            ];

            await render(
                <ScrollWrapper>
                    <GtkListView<TreeItem>
                        ref={ref}
                        estimatedItemHeight={48}
                        renderItem={(item) => {
                            if (!item) {
                                return <GtkLabel label="Loading..." />;
                            }
                            return <GtkLabel label={item.name} />;
                        }}
                    >
                        {categories.map((category) => (
                            <x.ListItem key={category.id} id={category.id} value={category as TreeItem}>
                                {category.children.map((setting) => (
                                    <x.ListItem
                                        key={setting.id}
                                        id={setting.id}
                                        value={setting as TreeItem}
                                        hideExpander
                                    />
                                ))}
                            </x.ListItem>
                        ))}
                    </GtkListView>
                </ScrollWrapper>,
            );

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const row = selectionModel.getObject(0) as Gtk.TreeListRow;

            const queryLabels = (text: string) => screen.queryAllByText(text);

            const assertChildrenVisible = () => {
                expect(queryLabels("Loading...")).toHaveLength(0);
                expect(queryLabels("Dark Mode")).toHaveLength(1);
                expect(queryLabels("Large Text")).toHaveLength(1);
                expect(queryLabels("Enable Animations")).toHaveLength(1);
                expect(queryLabels("Transparency Effects")).toHaveLength(1);
            };

            const assertChildrenHidden = () => {
                expect(queryLabels("Dark Mode")).toHaveLength(0);
                expect(queryLabels("Large Text")).toHaveLength(0);
                expect(queryLabels("Enable Animations")).toHaveLength(0);
                expect(queryLabels("Transparency Effects")).toHaveLength(0);
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
});
