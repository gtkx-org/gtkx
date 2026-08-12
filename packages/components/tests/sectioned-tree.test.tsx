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

type ListFixture = {
    ref: RefObject<Gtk.ListView | null>;
    addSection: () => Promise<void>;
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
const firstExpandedRows = [...soloSectionRows, "H:Two", "Solo 2", "Parent 2"];
const secondExpandedRows = ["H:One", "Parent 1", "Solo 1", "H:Two", "Solo 2", "Parent 2", "Child 3"];
const expandedColumnRows = ["Name", "Parent 1", "Child 1", "Child 2", "Solo 1", "Solo 2", "Parent 2"];

const expanderNamed = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const expanderCount = (): number => screen.queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander }).length;

const columnRowTexts = (): (string | null)[] =>
    screen
        .queryAllByRole(Gtk.AccessibleRole.ROW)
        .flatMap((row) => within(row).queryAllByRole(Gtk.AccessibleRole.LABEL))
        .map((label) => getWidgetText(label));

const drawList = (
    ref: RefObject<Gtk.ListView | null>,
    groups: ListSection<string, Named>[],
    expandedIds: string[],
    onExpandedChange?: (ids: string[]) => void,
): ReactNode => (
    <ScrollWrapper minContentHeight={500}>
        <ListView<Named, string>
            ref={ref}
            sections={groups}
            expandedIds={expandedIds}
            onExpandedChange={onExpandedChange}
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
    const ref = createRef<Gtk.ListView>();
    await render(drawList(ref, sections, expandedIds, onExpandedChange));

    return ref;
};

const renderGrowingList = async (): Promise<ListFixture> => {
    const ref = createRef<Gtk.ListView>();
    const { rerender } = await render(drawList(ref, firstSectionOnly, ["p1"]));

    return {
        ref,
        addSection: async () => {
            await rerender(drawList(ref, sections, ["p1"]));
        },
    };
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
        const { ref, addSection } = await renderGrowingList();
        await expectRowTexts(ref, soloSectionRows);
        await addSection();
        await expectRowTexts(ref, firstExpandedRows);
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
