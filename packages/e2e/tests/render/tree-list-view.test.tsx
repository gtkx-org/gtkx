import * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, TreeListItem, TreeListView } from "@gtkx/react";
import { cleanup, render, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getModelItemCount = (listView: Gtk.ListView): number => {
    const model = listView.getModel();
    if (!model) return 0;
    return model.getNItems() ?? 0;
};

const getModelItemOrder = (listView: Gtk.ListView): string[] => {
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

describe("render - TreeListView", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("TreeListView", () => {
        it("creates TreeListView widget", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"}>
                    <TreeListItem id="1" value={{ name: "First" }} />
                </TreeListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("TreeListItem", () => {
        it("adds item to tree model", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"}>
                    <TreeListItem id="1" value={{ name: "First" }} />
                    <TreeListItem id="2" value={{ name: "Second" }} />
                </TreeListView>,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("supports nested tree items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }}>
                        <TreeListItem id="child1" value={{ name: "Child 1" }} />
                        <TreeListItem id="child2" value={{ name: "Child 2" }} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        {items.map((item) => (
                            <TreeListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </TreeListView>
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

        it("removes item from tree model", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        {items.map((item) => (
                            <TreeListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </TreeListView>
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
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        <TreeListItem id="1" value={{ name: itemName }} />
                    </TreeListView>
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
                <TreeListView ref={ref} renderItem={renderItem}>
                    <TreeListItem id="1" value={{ name: "Test Item" }} />
                </TreeListView>,
                { wrapper: false },
            );
        });

        it("receives TreeListRow in renderItem", async () => {
            const ref = createRef<Gtk.ListView>();
            const renderItem = vi.fn((item: { name: string } | null, row: Gtk.TreeListRow | null) => (
                <GtkLabel label={`${item?.name ?? ""} - depth: ${row?.getDepth() ?? 0}`} />
            ));

            await render(
                <TreeListView ref={ref} renderItem={renderItem} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }}>
                        <TreeListItem id="child" value={{ name: "Child" }} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );
        });

        it("updates when renderItem function changes", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ prefix }: { prefix: string }) {
                return (
                    <TreeListView
                        ref={ref}
                        renderItem={(item: { name: string } | null) => (
                            <GtkLabel label={`${prefix}: ${item?.name ?? ""}`} />
                        )}
                    >
                        <TreeListItem id="1" value={{ name: "Test" }} />
                    </TreeListView>
                );
            }

            await render(<App prefix="First" />, { wrapper: false });

            await render(<App prefix="Second" />, { wrapper: false });
        });
    });

    describe("autoexpand", () => {
        it("sets autoexpand property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }}>
                        <TreeListItem id="child" value={{ name: "Child" }} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });

        it("shows children in model when autoexpand is true", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }}>
                        <TreeListItem id="child1" value={{ name: "Child 1" }} />
                        <TreeListItem id="child2" value={{ name: "Child 2" }} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(3);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["parent", "child1", "child2"]);
        });

        it("parent row is expandable when it has children", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"}>
                    <TreeListItem id="parent" value={{ name: "Parent" }}>
                        <TreeListItem id="child1" value={{ name: "Child 1" }} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
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
                <TreeListView ref={ref} renderItem={() => "Item"}>
                    <TreeListItem id="parent" value={{ name: "Parent" }}>
                        <TreeListItem id="child1" value={{ name: "Child 1" }} />
                        <TreeListItem id="child2" value={{ name: "Child 2" }} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(1);

            const selectionModel = ref.current?.getModel() as Gtk.SingleSelection;
            const row = selectionModel.getObject(0) as Gtk.TreeListRow;
            row.setExpanded(true);

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(3);
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["parent", "child1", "child2"]);
        });

        it("updates autoexpand property", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ autoexpand }: { autoexpand: boolean }) {
                return (
                    <TreeListView ref={ref} renderItem={() => "Item"} autoexpand={autoexpand}>
                        <TreeListItem id="parent" value={{ name: "Parent" }}>
                            <TreeListItem id="child" value={{ name: "Child" }} />
                        </TreeListItem>
                    </TreeListView>
                );
            }

            await render(<App autoexpand={false} />, { wrapper: false });

            await render(<App autoexpand={true} />, { wrapper: false });
        });
    });

    describe("selection - single", () => {
        it("sets selected item via selected prop", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} selected={["2"]}>
                    <TreeListItem id="1" value={{ name: "First" }} />
                    <TreeListItem id="2" value={{ name: "Second" }} />
                </TreeListView>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} onSelectionChanged={onSelectionChanged}>
                    <TreeListItem id="1" value={{ name: "First" }} />
                    <TreeListItem id="2" value={{ name: "Second" }} />
                </TreeListView>,
                { wrapper: false },
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, 0);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
        });

        it("handles unselect (empty selection)", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ selected }: { selected: string[] }) {
                return (
                    <TreeListView ref={ref} renderItem={() => "Item"} selected={selected}>
                        <TreeListItem id="1" value={{ name: "First" }} />
                    </TreeListView>
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
                <TreeListView ref={ref} renderItem={() => "Item"} selectionMode={Gtk.SelectionMode.MULTIPLE}>
                    <TreeListItem id="1" value={{ name: "First" }} />
                    <TreeListItem id="2" value={{ name: "Second" }} />
                </TreeListView>,
                { wrapper: false },
            );
        });

        it("sets multiple selected items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView
                    ref={ref}
                    renderItem={() => "Item"}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    selected={["1", "3"]}
                >
                    <TreeListItem id="1" value={{ name: "First" }} />
                    <TreeListItem id="2" value={{ name: "Second" }} />
                    <TreeListItem id="3" value={{ name: "Third" }} />
                </TreeListView>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <TreeListView
                    ref={ref}
                    renderItem={() => "Item"}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    onSelectionChanged={onSelectionChanged}
                >
                    <TreeListItem id="1" value={{ name: "First" }} />
                    <TreeListItem id="2" value={{ name: "Second" }} />
                </TreeListView>,
                { wrapper: false },
            );

            await userEvent.selectOptions(ref.current as Gtk.ListView, [0, 1]);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1", "2"]);
        });
    });

    describe("item reordering", () => {
        it("respects React declaration order on initial render", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"}>
                    <TreeListItem id="c" value={{ name: "C" }} />
                    <TreeListItem id="a" value={{ name: "A" }} />
                    <TreeListItem id="b" value={{ name: "B" }} />
                </TreeListView>,
                { wrapper: false },
            );

            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["c", "a", "b"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <TreeListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </TreeListView>
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
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <TreeListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </TreeListView>
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
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <TreeListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </TreeListView>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />, { wrapper: false });
            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["D", "B", "E"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: string[] }) {
                return (
                    <TreeListView ref={ref} renderItem={() => "Item"}>
                        {items.map((id) => (
                            <TreeListItem key={id} id={id} value={{ name: id }} />
                        ))}
                    </TreeListView>
                );
            }

            await render(<App items={["A", "B", "C"]} />, { wrapper: false });
            await render(<App items={["C", "A", "B"]} />, { wrapper: false });
            await render(<App items={["B", "C", "A"]} />, { wrapper: false });
            await render(<App items={["A", "B", "C"]} />, { wrapper: false });

            expect(getModelItemOrder(ref.current as Gtk.ListView)).toEqual(["A", "B", "C"]);
        });
    });

    describe("tree item properties", () => {
        it("supports indentForDepth property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }} indentForDepth={false}>
                        <TreeListItem id="child" value={{ name: "Child" }} indentForDepth={true} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports indentForIcon property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }} indentForIcon={true}>
                        <TreeListItem id="child" value={{ name: "Child" }} indentForIcon={false} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });

        it("supports hideExpander property", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <TreeListView ref={ref} renderItem={() => "Item"} autoexpand>
                    <TreeListItem id="parent" value={{ name: "Parent" }} hideExpander={false}>
                        <TreeListItem id="child" value={{ name: "Child" }} hideExpander={true} />
                    </TreeListItem>
                </TreeListView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });
});
