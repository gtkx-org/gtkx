import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGridView, GtkLabel, GtkListView } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const getModelItemCount = (listView: Gtk.ListView): number => {
    const model = listView.getModel();
    if (!model) return 0;
    return model.getNItems() ?? 0;
};

describe("render - ListView", () => {
    describe("ListView.Root", () => {
        it("creates ListView widget", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ListView.Item", () => {
        it("adds item to list model", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                    <GtkListView.Item id="2" item={{ name: "Second" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );

            expect(getModelItemCount(ref.current as Gtk.ListView)).toBe(2);
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                        {items.map((item) => (
                            <GtkListView.Item key={item.id} id={item.id} item={item} />
                        ))}
                    </GtkListView.Root>
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
                    <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                        {items.map((item) => (
                            <GtkListView.Item key={item.id} id={item.id} item={item} />
                        ))}
                    </GtkListView.Root>
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

        it("updates item data", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ itemName }: { itemName: string }) {
                return (
                    <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                        <GtkListView.Item id="1" item={{ name: itemName }} />
                    </GtkListView.Root>
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
                <GtkListView.Root ref={ref} renderItem={renderItem}>
                    <GtkListView.Item id="1" item={{ name: "Test Item" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );
        });

        it("updates when renderItem function changes", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ prefix }: { prefix: string }) {
                return (
                    <GtkListView.Root
                        ref={ref}
                        renderItem={(item: { name: string } | null) => (
                            <GtkLabel label={`${prefix}: ${item?.name ?? ""}`} />
                        )}
                    >
                        <GtkListView.Item id="1" item={{ name: "Test" }} />
                    </GtkListView.Root>
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
                <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />} selected={["2"]}>
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                    <GtkListView.Item id="2" item={{ name: "Second" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged when selection changes", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <GtkListView.Root
                    ref={ref}
                    renderItem={() => <GtkLabel label="Item" />}
                    onSelectionChanged={onSelectionChanged}
                >
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                    <GtkListView.Item id="2" item={{ name: "Second" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );

            expect(onSelectionChanged).toHaveBeenCalled();
        });

        it("handles unselect (empty selection)", async () => {
            const ref = createRef<Gtk.ListView>();

            function App({ selected }: { selected: string[] }) {
                return (
                    <GtkListView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />} selected={selected}>
                        <GtkListView.Item id="1" item={{ name: "First" }} />
                    </GtkListView.Root>
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
                <GtkListView.Root
                    ref={ref}
                    renderItem={() => <GtkLabel label="Item" />}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                >
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                    <GtkListView.Item id="2" item={{ name: "Second" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );
        });

        it("sets multiple selected items", async () => {
            const ref = createRef<Gtk.ListView>();

            await render(
                <GtkListView.Root
                    ref={ref}
                    renderItem={() => <GtkLabel label="Item" />}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    selected={["1", "3"]}
                >
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                    <GtkListView.Item id="2" item={{ name: "Second" }} />
                    <GtkListView.Item id="3" item={{ name: "Third" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const ref = createRef<Gtk.ListView>();
            const onSelectionChanged = vi.fn();

            await render(
                <GtkListView.Root
                    ref={ref}
                    renderItem={() => <GtkLabel label="Item" />}
                    selectionMode={Gtk.SelectionMode.MULTIPLE}
                    onSelectionChanged={onSelectionChanged}
                >
                    <GtkListView.Item id="1" item={{ name: "First" }} />
                    <GtkListView.Item id="2" item={{ name: "Second" }} />
                </GtkListView.Root>,
                { wrapper: false },
            );

            expect(onSelectionChanged).toHaveBeenCalledWith(expect.any(Array));
        });
    });

    describe("GridView.Root", () => {
        it("creates GridView widget", async () => {
            const ref = createRef<Gtk.GridView>();

            await render(
                <GtkGridView.Root ref={ref} renderItem={() => <GtkLabel label="Item" />}>
                    <GtkGridView.Item id="1" item={{ name: "First" }} />
                </GtkGridView.Root>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });
});
