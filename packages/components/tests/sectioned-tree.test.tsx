import type { ColumnViewColumn, ListItem, ListItemRenderArgs, ListSection } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
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

type ColumnFixture = {
    ref: RefObject<Gtk.ColumnView | null>;
    to: (next: ListDraw) => Promise<void>;
};

type StepFixture = {
    ref: RefObject<Gtk.Widget | null>;
    to: (next: ListDraw) => Promise<void>;
};

type SectionStep = {
    from: ListDraw;
    before: string[];
    next: ListDraw;
    after: string[];
};

type StatefulProps = {
    listRef: RefObject<Gtk.ListView | null>;
    onExpandedChange: (ids: string[]) => void;
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

const mirrorSection: ListSection<string, Named> = {
    id: "s3",
    value: "Three",
    data: [
        branch("p3", "Parent 3", [leaf("c4", "Child 4"), leaf("c5", "Child 5"), leaf("c6", "Child 6")]),
        leaf("x3", "Solo 3"),
    ],
};

const sections: ListSection<string, Named>[] = [firstSection, secondSection];
const firstSectionOnly: ListSection<string, Named>[] = [firstSection];
const secondSectionOnly: ListSection<string, Named>[] = [secondSection];
const mirrorSectionOnly: ListSection<string, Named>[] = [mirrorSection];
const firstThenMirror: ListSection<string, Named>[] = [firstSection, mirrorSection];
const columns: ColumnViewColumn<Named>[] = [{ id: "name", title: "Name", renderCell: renderItem }];
const soloSectionRows = ["H:One", "Parent 1", "Child 1", "Child 2", "Solo 1"];
const soloCollapsedRows = ["H:One", "Parent 1", "Solo 1"];
const firstExpandedRows = [...soloSectionRows, "H:Two", "Solo 2", "Parent 2"];
const collapsedRows = ["H:One", "Parent 1", "Solo 1", "H:Two", "Solo 2", "Parent 2"];
const secondExpandedRows = [...collapsedRows, "Child 3"];
const bothExpandedRows = [...firstExpandedRows, "Child 3"];
const secondOnlyRows = ["H:Two", "Solo 2", "Parent 2", "Child 3"];
const mirrorAfterFirstRows = [...soloSectionRows, "H:Three", "Parent 3", "Solo 3"];
const mirrorExpandedRows = ["H:Three", "Parent 3", "Child 4", "Child 5", "Child 6", "Solo 3"];
const columnTitle = "Name";
const expandedColumnRows = [columnTitle, ...firstExpandedRows];
const soloColumnRows = [columnTitle, ...soloSectionRows];
const collapsedColumnRows = [columnTitle, ...collapsedRows];
const secondColumnRows = [columnTitle, ...secondExpandedRows];
const secondOnlyColumnRows = [columnTitle, ...secondOnlyRows];
const soloPosition = 1;

const fromFirstSection: Pick<SectionStep, "before" | "from"> = {
    from: { groups: firstSectionOnly, expandedIds: ["p1"] },
    before: soloSectionRows,
};

const sectionAdded: SectionStep = {
    ...fromFirstSection,
    next: { groups: sections, expandedIds: ["p1"] },
    after: firstExpandedRows,
};

const expansionMoved: SectionStep = {
    ...fromFirstSection,
    next: { groups: sections, expandedIds: ["p2"] },
    after: secondExpandedRows,
};

const sectionDropped: SectionStep = {
    from: { groups: sections, expandedIds: ["p1"] },
    before: firstExpandedRows,
    next: { groups: firstSectionOnly, expandedIds: [] },
    after: soloCollapsedRows,
};

const earlierSectionDropped: SectionStep = {
    from: { groups: sections, expandedIds: ["p2"] },
    before: secondExpandedRows,
    next: { groups: secondSectionOnly, expandedIds: ["p2"] },
    after: secondOnlyRows,
};

const survivorKeepsExpansion: SectionStep = {
    from: { groups: firstThenMirror, expandedIds: ["p1"] },
    before: mirrorAfterFirstRows,
    next: { groups: mirrorSectionOnly, expandedIds: ["p3"] },
    after: mirrorExpandedRows,
};

const sectionPrepended: SectionStep = {
    from: { groups: secondSectionOnly, expandedIds: ["p2"] },
    before: secondOnlyRows,
    next: { groups: sections, expandedIds: ["p2"] },
    after: secondExpandedRows,
};

const sameSectionsCollapsed: SectionStep = {
    from: { groups: sections, expandedIds: ["p1", "p2"] },
    before: bothExpandedRows,
    next: { groups: sections, expandedIds: ["p2"] },
    after: secondExpandedRows,
};

const columnEarlierSectionDropped: SectionStep = {
    from: { groups: sections, expandedIds: ["p2"] },
    before: secondColumnRows,
    next: { groups: secondSectionOnly, expandedIds: ["p2"] },
    after: secondOnlyColumnRows,
};

const columnSectionAdded: SectionStep = {
    from: { groups: firstSectionOnly, expandedIds: ["p1"] },
    before: soloColumnRows,
    next: { groups: sections, expandedIds: [] },
    after: collapsedColumnRows,
};

const expanderNamed = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const expanderCount = (): number => screen.queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander }).length;

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

const drawColumns = (ref: RefObject<Gtk.ColumnView | null>, draw: ListDraw): ReactNode => (
    <ScrollWrapper minContentHeight={500}>
        <ColumnView<Named, string>
            ref={ref}
            sections={draw.groups}
            expandedIds={draw.expandedIds}
            columns={columns}
            renderHeader={renderHeader}
        />
    </ScrollWrapper>
);

const renderList = async (expandedIds: string[]): Promise<RefObject<Gtk.ListView | null>> => {
    const { ref } = await renderFixture({ groups: sections, expandedIds });

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

const renderColumns = async (draw: ListDraw): Promise<ColumnFixture> => {
    const ref = createRef<Gtk.ColumnView>();
    const { rerender } = await render(drawColumns(ref, draw));

    return {
        ref,
        to: async (next) => {
            await rerender(drawColumns(ref, next));
        },
    };
};

const renderFirstSection = (handlers: ListHandlers = {}, selectedIds?: string[]): Promise<ListFixture> =>
    renderFixture({ groups: firstSectionOnly, expandedIds: ["p1"], selectedIds }, handlers);

const expectSectionStep = async (open: (draw: ListDraw) => Promise<StepFixture>, step: SectionStep): Promise<void> => {
    const { ref, to } = await open(step.from);
    await expectRowTexts(ref, step.before);
    await to(step.next);
    await expectRowTexts(ref, step.after);
};

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

function StatefulSections({ listRef, onExpandedChange }: StatefulProps): ReactNode {
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    return drawList(
        listRef,
        { groups: sections, expandedIds },
        {
            onExpandedChange: (ids) => {
                setExpandedIds(ids);
                onExpandedChange(ids);
            },
        },
    );
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
        await expectSectionStep(renderFixture, sectionAdded);
    });

    it("moves the expansion into the section that just arrived", async () => {
        await expectSectionStep(renderFixture, expansionMoved);
    });

    it("collapses a nested row when a section is dropped and expandedIds empties", async () => {
        await expectSectionStep(renderFixture, sectionDropped);
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
});

describe("sectioned tree - ListView (3)", () => {
    it("keeps a later section expanded when the section before it is dropped", async () => {
        await expectSectionStep(renderFixture, earlierSectionDropped);
    });

    it("shows the surviving section's own children under the row that stays expanded", async () => {
        await expectSectionStep(renderFixture, survivorKeepsExpansion);
    });

    it("keeps a nested row expanded when a section is prepended", async () => {
        await expectSectionStep(renderFixture, sectionPrepended);
    });

    it("collapses one section while the sections array stays the same", async () => {
        await expectSectionStep(renderFixture, sameSectionsCollapsed);
    });
});

describe("sectioned tree - ListView (4)", () => {
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

    it("expands and reports the row whose sectioned expander is clicked", async () => {
        const onExpandedChange = vi.fn();
        const ref = createRef<Gtk.ListView>();
        await render(<StatefulSections listRef={ref} onExpandedChange={onExpandedChange} />);
        await userEvent.click(expanderNamed("Parent 2"));
        await expectRowTexts(ref, secondExpandedRows);

        await waitFor(() => {
            expect(onExpandedChange).toHaveBeenLastCalledWith(["p2"]);
        });
    });
});

describe("sectioned tree - ColumnView", () => {
    it("expands children nested under a section", async () => {
        const { ref } = await renderColumns({ groups: sections, expandedIds: ["p1"] });
        await expectRowTexts(ref, expandedColumnRows);
    });

    it("keeps a later section expanded when the section before it is dropped", async () => {
        await expectSectionStep(renderColumns, columnEarlierSectionDropped);
    });

    it("collapses a nested row when a section arrives and expandedIds empties", async () => {
        await expectSectionStep(renderColumns, columnSectionAdded);
    });
});
