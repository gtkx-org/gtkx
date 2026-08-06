import type * as Gio from "@gtkx/gi/gio";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectMultiSelectionAdopted } from "./helpers/list-collection-render.js";
import {
    allExpandableIds,
    firstSecondItems,
    firstSecondThirdItems,
    renderListView,
    renderStatefulListView,
} from "./helpers/list-fixtures.js";

type SidebarItem = {
    id: string;
    name: string;
    children?: SidebarItem[];
};

type SidebarRefs = {
    listRef: RefObject<Gtk.ListView | null>;
    scrollRef: RefObject<Gtk.ScrolledWindow | null>;
};

type NamedEntry = {
    id: string;
    name: string;
};

const firstOnlyItems = [{ id: "1", value: { name: "First" } }];
const sidebarData: SidebarItem[] = [{ id: "intro", name: "Introduction" }, ...buildNestedGroups("cat", "demo")];

const expectFirstRowClickSelects = async (): Promise<void> => {
    const { ref } = await renderStatefulListView(firstSecondItems);
    await userEvent.selectOptions(ref.current, 0);

    await waitFor(() => {
        expect(screen.queryAllByText("selected:1")).toHaveLength(1);
    });
};

const expectUnselectKeepsRow = async (): Promise<void> => {
    const { rerender } = await renderListView(firstOnlyItems, { selected: ["1"] });
    await rerender(firstOnlyItems, { selected: [] });
    expect(screen.queryAllByText("First")).toHaveLength(1);
};

const toSidebarListItems = (items: SidebarItem[]) =>
    items.map((item) => ({
        id: item.id,
        value: item,
        shouldHideExpander: !item.children,
        children: item.children?.map((child) => ({
            id: child.id,
            value: child,
            shouldHideExpander: true,
        })),
    }));

function buildNestedGroups(groupPrefix: string, childPrefix: string): (NamedEntry & { children: NamedEntry[] })[] {
    return Array.from({ length: 20 }, (_, gi) => ({
        id: `${groupPrefix}-${String(gi)}`,
        name: `${groupPrefix} ${String(gi)}`,
        children: Array.from({ length: 5 }, (_, ci) => ({
            id: `${groupPrefix}-${String(gi)}-${childPrefix}-${String(ci)}`,
            name: `${groupPrefix} ${String(gi)} ${childPrefix} ${String(ci)}`,
        })),
    }));
}

function SidebarTree({
    listRef,
    scrollRef,
    selectedId,
    onSelect,
}: SidebarRefs & {
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    return (
        <GtkScrolledWindow ref={scrollRef} minContentHeight={200} maxContentHeight={200} minContentWidth={200}>
            <ListView
                ref={listRef}
                cssClasses={["navigation-sidebar"]}
                expandedIds={allExpandableIds(toSidebarListItems(sidebarData))}
                selectionMode={Gtk.SelectionMode.SINGLE}
                items={toSidebarListItems(sidebarData)}
                selectedIds={selectedId ? [selectedId] : []}
                onSelectionChanged={(ids: string[]) => {
                    const id = ids[0];

                    if (id) {
                        onSelect(id);
                    }
                }}
                renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
            />
        </GtkScrolledWindow>
    );
}

function SidebarApp({ listRef, scrollRef }: SidebarRefs) {
    const [selectedId, setSelectedId] = useState<string | null>("intro");
    const selectedItem = sidebarData.flatMap((d) => [d, ...(d.children ?? [])]).find((d) => d.id === selectedId);

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
            <SidebarTree listRef={listRef} scrollRef={scrollRef} selectedId={selectedId} onSelect={setSelectedId} />
            <GtkLabel vexpand hexpand>
                {selectedItem?.name ?? "None"}
            </GtkLabel>
        </GtkBox>
    );
}

describe("render - ListView - selection (1)", () => {
    describe("single (1)", () => {
        it("sets selected item via selected prop", async () => {
            await renderListView(firstSecondItems, { selected: ["2"] });
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("calls onSelectionChanged when selection changes", async () => {
            await expectFirstRowClickSelects();
        });

        it("selects correct item after scrolling to bottom of large list", async () => {
            const items = Array.from({ length: 100 }, (_, i) => ({
                id: `item-${String(i)}`,
                value: { name: `Item ${String(i)}` },
            }));

            const { ref } = await renderStatefulListView(items);
            const listView = ref.current;
            listView.scrollTo(99, Gtk.ListScrollFlags.NONE, null);
            await userEvent.selectOptions(listView, 99);

            await waitFor(() => {
                expect(screen.queryAllByText("selected:item-99")).toHaveLength(1);
            });
        });
    });
});

describe("render - ListView - selection (2)", () => {
    describe("single (2)", () => {
        it("handles unselect (empty selection)", async () => {
            await expectUnselectKeepsRow();
        });
    });
});

describe("render - ListView - selection (3)", () => {
    describe("multiple", () => {
        it("enables multi-select with selectionMode", async () => {
            await renderListView(firstSecondItems, { selectionMode: Gtk.SelectionMode.MULTIPLE });
            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Second")).toHaveLength(1);
        });

        it("sets multiple selected items", async () => {
            await renderListView(firstSecondThirdItems, {
                selectionMode: Gtk.SelectionMode.MULTIPLE,
                selected: ["1", "3"],
            });

            expect(screen.queryAllByText("First")).toHaveLength(1);
            expect(screen.queryAllByText("Third")).toHaveLength(1);
        });

        it("calls onSelectionChanged with array of ids", async () => {
            await expectMultiSelectionAdopted();
        });
    });
});

describe("render - ListView - selection (4)", () => {
    describe("tree - single (1)", () => {
        it("sets selected item via selected prop", async () => {
            const onSelectionChanged = vi.fn();
            await renderListView(firstSecondItems, { selected: ["2"], onSelectionChanged });
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

        it("calls onSelectionChanged when selection changes", async () => {
            await expectFirstRowClickSelects();
        });
    });
});

describe("render - ListView - selection (5)", () => {
    describe("tree - single (2)", () => {
        it("handles unselect (empty selection)", async () => {
            await expectUnselectKeepsRow();
        });

        it("selects correct child item after scrolling to bottom of expanded tree", async () => {
            const groups = buildNestedGroups("group", "child");

            const { ref } = await renderStatefulListView(
                groups.map((group) => ({
                    id: group.id,
                    value: { name: group.name },
                    children: group.children.map((child) => ({
                        id: child.id,
                        value: { name: child.name },
                        shouldHideExpander: true,
                    })),
                })),
                { shouldExpandAll: true },
            );

            const listView = ref.current;
            const model = listView.getModel() as Gio.ListModel;
            const lastPosition = model.getNItems() - 1;
            listView.scrollTo(lastPosition, Gtk.ListScrollFlags.NONE, null);
            await userEvent.selectOptions(listView, lastPosition);

            await waitFor(() => {
                expect(screen.queryAllByText("selected:group-19-child-4")).toHaveLength(1);
            });
        });
    });
});

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
        expect(selectionModel).toHaveObjectProperty("selected", targetPosition);
        const scrollPosAfter = vadj.getValue();
        expect(scrollPosAfter).toBe(scrollPosBefore);
    });
});

describe("render - ListView - selection (7) > selectionMode + selected together", () => {
    it("keeps the selection when selectionMode and selected change in the same render", async () => {
        const { ref, rerender } = await renderListView(firstSecondThirdItems, {
            selectionMode: Gtk.SelectionMode.SINGLE,
            selected: ["1"],
        });

        await rerender(firstSecondThirdItems, {
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            selected: ["1", "3"],
        });

        await waitFor(() => {
            const selection = (ref.current.getModel() as Gtk.MultiSelection).getSelection();
            expect(selection.getSize()).toBe(2n);
            expect(selection.contains(0)).toBe(true);
            expect(selection.contains(2)).toBe(true);
        });
    });
});
