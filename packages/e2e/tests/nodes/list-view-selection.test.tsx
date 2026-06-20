import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkListView, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderListView } from "../helpers/list-fixtures.js";

const TWO_ITEMS = [
    { id: "1", value: { name: "First" } },
    { id: "2", value: { name: "Second" } },
];

const THREE_ITEMS = [...TWO_ITEMS, { id: "3", value: { name: "Third" } }];

const expectSelectionChangedOnFirstRowClick = async (): Promise<void> => {
    const onSelectionChanged = vi.fn();

    const { ref } = await renderListView(TWO_ITEMS, { onSelectionChanged });

    await userEvent.selectOptions(ref.current, 0);

    expect(onSelectionChanged).toHaveBeenCalledWith(["1"]);
};

const expectUnselectKeepsRow = async (): Promise<void> => {
    const { rerender } = await renderListView([{ id: "1", value: { name: "First" } }], { selected: ["1"] });

    await rerender([{ id: "1", value: { name: "First" } }], { selected: [] });

    expect(screen.queryAllByText("First")).toHaveLength(1);
};

describe("render - ListView - selection (1)", () => {
    describe("single (1)", () => {
        it("sets selected item via selected prop", async () => {
            await renderListView(TWO_ITEMS, { selected: ["2"] });

            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("calls onSelectionChanged when selection changes", expectSelectionChangedOnFirstRowClick);

        it("selects correct item after scrolling to bottom of large list", async () => {
            const onSelectionChanged = vi.fn();
            const items = Array.from({ length: 100 }, (_, i) => ({
                id: `item-${i}`,
                value: { name: `Item ${i}` },
            }));

            const { ref } = await renderListView(items, { onSelectionChanged });

            const listView = ref.current;
            listView.scrollTo(99, Gtk.ListScrollFlags.NONE, null);

            await userEvent.selectOptions(listView, 99);

            expect(onSelectionChanged).toHaveBeenCalledWith(["item-99"]);
        });
    });
});

describe("render - ListView - selection (2)", () => {
    describe("single (2)", () => {
        it("handles unselect (empty selection)", expectUnselectKeepsRow);
    });
});

describe("render - ListView - selection (3)", () => {
    describe("multiple", () => {
        it("enables multi-select with selectionMode", async () => {
            await renderListView(TWO_ITEMS, { selectionMode: Gtk.SelectionMode.MULTIPLE });

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("sets multiple selected items", async () => {
            await renderListView(THREE_ITEMS, {
                selectionMode: Gtk.SelectionMode.MULTIPLE,
                selected: ["1", "3"],
            });

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });

        it("calls onSelectionChanged with array of ids", async () => {
            const onSelectionChanged = vi.fn();

            const { ref } = await renderListView(TWO_ITEMS, {
                selectionMode: Gtk.SelectionMode.MULTIPLE,
                onSelectionChanged,
            });

            await userEvent.selectOptions(ref.current, [0, 1]);

            expect(onSelectionChanged).toHaveBeenCalledWith(["1", "2"]);
        });
    });
});

describe("render - ListView - selection (4)", () => {
    describe("tree - single (1)", () => {
        it("sets selected item via selected prop", async () => {
            const onSelectionChanged = vi.fn();

            await renderListView(TWO_ITEMS, { selected: ["2"], onSelectionChanged });

            expect(onSelectionChanged).toHaveBeenCalledWith(["2"]);
        });

        it("sets initial selection on first render", async () => {
            const onSelectionChanged = vi.fn();

            await renderListView(
                [
                    { id: "first", value: { name: "First" } },
                    { id: "second", value: { name: "Second" } },
                    { id: "third", value: { name: "Third" } },
                ],
                { selected: ["first"], onSelectionChanged },
            );

            expect(onSelectionChanged).toHaveBeenCalledWith(["first"]);
        });

        it("calls onSelectionChanged when selection changes", expectSelectionChangedOnFirstRowClick);
    });
});

describe("render - ListView - selection (5)", () => {
    describe("tree - single (2)", () => {
        it("handles unselect (empty selection)", expectUnselectKeepsRow);

        it("selects correct child item after scrolling to bottom of expanded tree", async () => {
            const onSelectionChanged = vi.fn();
            const groups = Array.from({ length: 20 }, (_, gi) => ({
                id: `group-${gi}`,
                name: `Group ${gi}`,
                children: Array.from({ length: 5 }, (_, ci) => ({
                    id: `group-${gi}-child-${ci}`,
                    name: `Group ${gi} Child ${ci}`,
                })),
            }));

            const { ref } = await renderListView(
                groups.map((group) => ({
                    id: group.id,
                    value: { name: group.name },
                    children: group.children.map((child) => ({
                        id: child.id,
                        value: { name: child.name },
                        hideExpander: true,
                    })),
                })),
                { autoexpand: true, onSelectionChanged },
            );

            const listView = ref.current;
            const model = listView.getModel() as Gio.ListModel;
            const lastPosition = model.getNItems() - 1;
            listView.scrollTo(lastPosition, Gtk.ListScrollFlags.NONE, null);

            await userEvent.selectOptions(listView, lastPosition);

            expect(onSelectionChanged).toHaveBeenCalledWith(["group-19-child-4"]);
        });
    });
});

interface SidebarItem {
    id: string;
    name: string;
    children?: SidebarItem[];
}

const sidebarData: SidebarItem[] = [
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

const toSidebarListItems = (items: SidebarItem[]) =>
    items.map((item) => ({
        id: item.id,
        value: item,
        hideExpander: !item.children,
        children: item.children?.map((child) => ({
            id: child.id,
            value: child,
            hideExpander: true,
        })),
    }));

function SidebarTree({
    listRef,
    scrollRef,
    selectedId,
    onSelect,
}: {
    listRef: RefObject<Gtk.ListView | null>;
    scrollRef: RefObject<Gtk.ScrolledWindow | null>;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    return (
        <GtkScrolledWindow ref={scrollRef} minContentHeight={200} maxContentHeight={200} minContentWidth={200}>
            <GtkListView
                ref={listRef}
                cssClasses={["navigation-sidebar"]}
                autoexpand
                selectionMode={Gtk.SelectionMode.SINGLE}
                items={toSidebarListItems(sidebarData)}
                selected={selectedId ? [selectedId] : []}
                onSelectionChanged={(ids: string[]) => {
                    const id = ids[0];
                    if (id) onSelect(id);
                }}
                renderItem={(item: SidebarItem) => <GtkLabel label={item.name} />}
            />
        </GtkScrolledWindow>
    );
}

function SidebarApp({
    listRef,
    scrollRef,
}: {
    listRef: RefObject<Gtk.ListView | null>;
    scrollRef: RefObject<Gtk.ScrolledWindow | null>;
}) {
    const [selectedId, setSelectedId] = useState<string | null>("intro");
    const selectedItem = sidebarData.flatMap((d) => [d, ...(d.children ?? [])]).find((d) => d.id === selectedId);

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
            <SidebarTree listRef={listRef} scrollRef={scrollRef} selectedId={selectedId} onSelect={setSelectedId} />
            <GtkLabel label={selectedItem?.name ?? "None"} vexpand hexpand />
        </GtkBox>
    );
}

describe("render - ListView - selection (6) > tree - single (3)", () => {
    it("preserves tree state and scroll position when selecting after scrolling down", async () => {
        const ref = createRef<Gtk.ListView>();
        const scrollRef = createRef<Gtk.ScrolledWindow>();

        await render(<SidebarApp listRef={ref} scrollRef={scrollRef} />);

        const listView = ref.current as Gtk.ListView;
        const selectionModel = listView.getModel() as Gtk.SingleSelection;
        const totalItems = selectionModel.getNItems();

        const targetPosition = totalItems - 1;
        const scrolledWindow = scrollRef.current as Gtk.ScrolledWindow;
        const vadj = scrolledWindow.getVadjustment();

        await waitFor(() => {
            expect(vadj.getUpper()).toBeGreaterThan(vadj.getPageSize());
        });

        listView.scrollTo(targetPosition, Gtk.ListScrollFlags.FOCUS, null);

        await waitFor(() => {
            if (vadj.getValue() === 0) {
                vadj.setValue(vadj.getUpper() - vadj.getPageSize());
            }
            expect(vadj.getValue()).toBeGreaterThan(0);
        });

        const scrollPosBefore = vadj.getValue();
        expect(scrollPosBefore).toBeGreaterThan(0);

        await userEvent.selectOptions(listView, targetPosition);

        expect(selectionModel.getSelected()).toBe(targetPosition);

        const scrollPosAfter = vadj.getValue();
        expect(scrollPosAfter).toBe(scrollPosBefore);
    });
});

describe("render - ListView - selection (7) > selectionMode + selected together", () => {
    it("keeps the selection when selectionMode and selected change in the same render", async () => {
        const { ref, rerender } = await renderListView(THREE_ITEMS, {
            selectionMode: Gtk.SelectionMode.SINGLE,
            selected: ["1"],
        });

        await rerender(THREE_ITEMS, {
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            selected: ["1", "3"],
        });

        const selection = (ref.current.getModel() as Gtk.MultiSelection).getSelection();
        expect(selection.getSize()).toBe(2n);
        expect(selection.contains(0)).toBe(true);
        expect(selection.contains(2)).toBe(true);
    });
});
