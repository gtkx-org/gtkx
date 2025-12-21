import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGridView, GtkLabel, GtkListView, ListItem } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const getModelItemCount = (listView: Gtk.ListView): number => {
    const model = listView.getModel();
    if (!model) return 0;
    return model.getNItems() ?? 0;
};

describe("render - ListView", () => {
    describe("GtkListView", () => {
        it("creates ListView widget", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />}>
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
                <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />}>
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
                    <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />}>
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
                    <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />}>
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
                    <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />}>
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
                <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />} selected={["2"]}>
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
                <GtkListView
                    ref={ref}
                    renderItem={() => <GtkLabel label="Item" />}
                    onSelectionChanged={onSelectionChanged}
                >
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(onSelectionChanged).toHaveBeenCalled();
        });

        it("handles unselect (empty selection)", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ selected }: { selected: string[] }) {
                return (
                    <GtkListView ref={ref} renderItem={() => <GtkLabel label="Item" />} selected={selected}>
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
                <GtkListView
                    ref={ref}
                    renderItem={() => <GtkLabel label="Item" />}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                >
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
                    renderItem={() => <GtkLabel label="Item" />}
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
                    renderItem={() => <GtkLabel label="Item" />}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    onSelectionChanged={onSelectionChanged}
                >
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkListView>,
                { wrapper: false },
            );

            expect(onSelectionChanged).toHaveBeenCalledWith(expect.any(Array));
        });
    });

    describe("GtkGridView", () => {
        it("creates GridView widget", async () => {
            const ref = createRef<Gtk.GridView>();

            await render(
                <GtkGridView ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkGridView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });
});
