import type { ColumnViewColumn, ListItem, ListItemRenderArgs, ListSection } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, getWidgetText, render, screen, waitFor, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectRowTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Named = { name: string };

type ListDraw = {
    groups: ListSection<string, Named>[];
    expandedIds: string[];
    selectedIds?: string[] | undefined;
};

type ListHandlers = {
    onExpandedChange?: ((ids: string[]) => void) | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | undefined;
};

type ListFixture = {
    ref: RefObject<Gtk.ListView | null>;
    to: (next: ListDraw) => Promise<void>;
};

const firstSection: ListSection<string, Named> = {
    id: "s1",
    value: "One",
    data: [branch("p1", "Parent 1", [leaf("c1", "Child 1"), leaf("c2", "Child 2")]), leaf("x1", "Solo 1")],
};

const secondSection: ListSection<string, Named> = {
    id: "s2",
    value: "Two",
    data: [leaf("x2", "Solo 2"), branch("p2", "Parent 2", [leaf("c3", "Child 3")])],
};

const sections: ListSection<string, Named>[] = [firstSection, secondSection];
const firstSectionOnly: ListSection<string, Named>[] = [firstSection];
const columns: ColumnViewColumn<Named>[] = [{ id: "name", title: "Name", renderCell: renderItem }];
const soloSectionRows = ["H:One", "Parent 1", "Child 1", "Child 2", "Solo 1"];
const soloCollapsedRows = ["H:One", "Parent 1", "Solo 1"];
const firstExpandedRows = [...soloSectionRows, "H:Two", "Solo 2", "Parent 2"];
const collapsedRows = ["H:One", "Parent 1", "Solo 1", "H:Two", "Solo 2", "Parent 2"];
const secondExpandedRows = [...collapsedRows, "Child 3"];
const soloPosition = 1;
const expandedColumnRows = ["Name", "Parent 1", "Child 1", "Child 2", "Solo 1", "Solo 2", "Parent 2"];

const expanderNamed = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const expanderCount = (): number => screen.queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander }).length;

const columnRowTexts = (): (string | null)[] =>
    screen
        .queryAllByRole(Gtk.AccessibleRole.ROW)
        .flatMap((row) => within(row).queryAllByRole(Gtk.AccessibleRole.LABEL))
        .map((label) => getWidgetText(label));

const drawList = (ref: RefObject<Gtk.ListView | null>, draw: ListDraw, handlers: ListHandlers): ReactNode => (
    <ScrollWrapper minContentHeight={500}>
        <ListView<Named, string>
            ref={ref}
            sections={draw.groups}
            expandedIds={draw.expandedIds}
            selectedIds={draw.selectedIds}
            selectionMode={Gtk.SelectionMode.MULTIPLE}
            onExpandedChange={handlers.onExpandedChange}
            onSelectionChanged={handlers.onSelectionChanged}
            renderItem={renderItem}
            renderHeader={renderHeader}
        />
    </ScrollWrapper>
);

const drawColumns = (ref: RefObject<Gtk.ColumnView | null>, expandedIds: string[]): ReactNode => (
    <ScrollWrapper minContentHeight={500}>
        <ColumnView<Named, string>
            ref={ref}
            sections={sections}
            expandedIds={expandedIds}
            columns={columns}
            renderHeader={renderHeader}
        />
    </ScrollWrapper>
);

const renderList = async (
    expandedIds: string[],
    onExpandedChange?: (ids: string[]) => void,
): Promise<RefObject<Gtk.ListView | null>> => {
    const { ref } = await renderFixture({ groups: sections, expandedIds }, { onExpandedChange });

    return ref;
};

const renderFixture = async (draw: ListDraw, handlers: ListHandlers = {}): Promise<ListFixture> => {
    const ref = createRef<Gtk.ListView>();
    const { rerender } = await render(drawList(ref, draw, handlers));

    return {
        ref,
        to: async (next) => {
            await rerender(drawList(ref, next, handlers));
        },
    };
};

const renderFirstSection = (handlers: ListHandlers = {}, selectedIds?: string[]): Promise<ListFixture> =>
    renderFixture({ groups: firstSectionOnly, expandedIds: ["p1"], selectedIds }, handlers);

const selectedPositions = (ref: RefObject<Gtk.ListView | null>): number[] => {
    const model = ref.current?.getModel();

    if (!(model instanceof Gtk.MultiSelection)) {
        throw new TypeError("Expected the list to carry a multi selection");
    }

    const selection = model.getSelection();

    return Array.from({ length: Number(selection.getSize()) }, (_, entry) => selection.getNth(entry));
};

function leaf(id: string, name: string): ListItem<Named> {
    return { id, value: { name } };
}

function branch(id: string, name: string, children: ListItem<Named>[]): ListItem<Named> {
    return { id, value: { name }, children };
}

function renderItem({ item }: ListItemRenderArgs<Named>): ReactNode {
    return <GtkLabel>{item.name}</GtkLabel>;
}

function renderHeader({ section }: { section: string }): ReactNode {
    return <GtkLabel>{`H:${section}`}</GtkLabel>;
}

describe("sectioned tree - ListView (1)", () => {
    it("expands children nested under a section", async () => {
        const ref = await renderList(["p1"]);
        await expectRowTexts(ref, firstExpandedRows);
    });

    it("expands a row that lives past the first section", async () => {
        const ref = await renderList(["p2"]);
        await expectRowTexts(ref, secondExpandedRows);
    });

    it("gives every sectioned row a tree expander", async () => {
        await renderList([]);

        await waitFor(() => {
            expect(expanderCount()).toBe(4);
        });
    });
});

describe("sectioned tree - ListView (2)", () => {
    it("keeps a nested row expanded when a section is added", async () => {
        const { ref, to } = await renderFirstSection();
        await expectRowTexts(ref, soloSectionRows);
        await to({ groups: sections, expandedIds: ["p1"] });
        await expectRowTexts(ref, firstExpandedRows);
    });

    it("collapses a nested row when a section arrives and expandedIds empties", async () => {
        const onExpandedChange = vi.fn();
        const { ref, to } = await renderFirstSection({ onExpandedChange });
        await to({ groups: sections, expandedIds: [] });
        await expectRowTexts(ref, collapsedRows);

        await waitFor(() => {
            expect(onExpandedChange).toHaveBeenLastCalledWith([]);
        });
    });

    it("moves the expansion into the section that just arrived", async () => {
        const { ref, to } = await renderFirstSection();
        await to({ groups: sections, expandedIds: ["p2"] });
        await expectRowTexts(ref, secondExpandedRows);
    });

    it("collapses a nested row when a section is dropped and expandedIds empties", async () => {
        const { ref, to } = await renderFixture({ groups: sections, expandedIds: ["p1"] });
        await expectRowTexts(ref, firstExpandedRows);
        await to({ groups: firstSectionOnly, expandedIds: [] });
        await expectRowTexts(ref, soloCollapsedRows);
    });
});

describe("sectioned tree - ListView (3)", () => {
    it("selects the row named by selectedIds after a section arrives", async () => {
        const onSelectionChanged = vi.fn();
        const { ref, to } = await renderFirstSection({ onSelectionChanged }, []);
        await to({ groups: sections, expandedIds: [], selectedIds: ["x1"] });
        await expectRowTexts(ref, collapsedRows);

        await waitFor(() => {
            expect(selectedPositions(ref)).toEqual([soloPosition]);
            expect(onSelectionChanged).toHaveBeenLastCalledWith(["x1"]);
        });
    });

    it("reports onExpandedChange when a sectioned row is expanded", async () => {
        const onExpandedChange = vi.fn();
        await renderList([], onExpandedChange);
        const row = expanderNamed("Parent 2").getListRow();

        if (row === null) {
            throw new TypeError("Expected the sectioned row to carry a tree list row");
        }

        await act(() => {
            row.setExpanded(true);
        });

        await waitFor(() => {
            expect(onExpandedChange).toHaveBeenCalledWith(["p2"]);
        });
    });
});

describe("sectioned tree - ColumnView", () => {
    it("expands children nested under a section", async () => {
        const ref = createRef<Gtk.ColumnView>();
        await render(drawColumns(ref, ["p1"]));

        await waitFor(() => {
            expect(columnRowTexts()).toEqual(expandedColumnRows);
        });

        expect(await screen.findAllByText("H:One")).toHaveLength(1);
        expect(await screen.findAllByText("H:Two")).toHaveLength(1);
        expect(ref.current).not.toBeNull();
    });
});
