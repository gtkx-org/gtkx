import type { ListItem, ListItemRenderArgs, ListSection } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expanderCount, expanderNamed } from "./helpers/expanders.js";
import { expectRowTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

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

const mirrorSection: ListSection<string, Named> = {
    id: "s3",
    value: "Three",
    data: [branch("p3", "Parent 3", [leaf("c4", "Child 4")]), leaf("x3", "Solo 3")],
};

const repeatedIdSections: ListSection<string, Named>[] = [
    { id: "s", value: "First", data: [leaf("a", "Alpha")] },
    { id: "s", value: "Second", data: [leaf("b", "Beta")] },
];

const sections = [firstSection, secondSection];
const firstSectionOnly = [firstSection];
const secondSectionOnly = [secondSection];
const firstExpandedRows = ["H:One", "Parent 1", "Child 1", "Child 2", "Solo 1", "H:Two", "Solo 2", "Parent 2"];
const collapsedRows = ["H:One", "Parent 1", "Solo 1", "H:Two", "Solo 2", "Parent 2"];
const secondExpandedRows = [...collapsedRows, "Child 3"];
const secondOnlyRows = ["H:Two", "Solo 2", "Parent 2", "Child 3"];
const soloSectionRows = ["H:One", "Parent 1", "Child 1", "Child 2", "Solo 1"];
const mirrorExpandedRows = ["H:Three", "Parent 3", "Child 4", "Solo 3"];
const soloPosition = 1;

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

const selectedPositions = (ref: RefObject<Gtk.ListView | null>): number[] => {
    const model = ref.current?.getModel();

    if (!(model instanceof Gtk.MultiSelection)) {
        throw new TypeError("Expected the list to carry a multi selection");
    }

    const selection = model.getSelection();

    return Array.from({ length: Number(selection.getSize()) }, (_, entry) => selection.getNth(entry));
};

function StatefulSections({ listRef }: { listRef: RefObject<Gtk.ListView | null> }): ReactNode {
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    return drawList(listRef, { groups: sections, expandedIds }, { onExpandedChange: setExpandedIds });
}

describe("ListView sections", () => {
    it("draws a header per section and models only the children as items", async () => {
        const { ref } = await renderFixture({ groups: sections, expandedIds: [] });
        await expectRowTexts(ref, collapsedRows);
        expect(ref.current?.getModel()).toHaveObjectProperty("nItems", 4);
    });

    it("renders the header content as the header's direct child", async () => {
        const { ref } = await renderFixture({ groups: sections, expandedIds: [] });
        const [headerLabel] = await screen.findAllByText("H:One");

        if (headerLabel === undefined || ref.current === null) {
            throw new TypeError("Expected the header to render");
        }

        expectNoBoxBetween(headerLabel, ref.current);
    });

    it("keeps two sections that share an id apart", async () => {
        const { ref } = await renderFixture({ groups: repeatedIdSections, expandedIds: [] });
        await expectRowTexts(ref, ["H:First", "Alpha", "H:Second", "Beta"]);
    });

    it("selects the row named by selectedIds once a section arrives", async () => {
        const onSelectionChanged = vi.fn();
        const from = { groups: firstSectionOnly, expandedIds: ["p1"] };
        const { ref, to } = await renderFixture(from, { onSelectionChanged });
        await to({ groups: sections, expandedIds: [], selectedIds: ["x1"] });
        await expectRowTexts(ref, collapsedRows);

        await waitFor(() => {
            expect(selectedPositions(ref)).toEqual([soloPosition]);
            expect(onSelectionChanged).toHaveBeenLastCalledWith(["x1"]);
        });
    });
});

describe("ListView sectioned trees", () => {
    it("expands the rows expandedIds names in any section", async () => {
        const { ref, to } = await renderFixture({ groups: sections, expandedIds: ["p1"] });
        await expectRowTexts(ref, firstExpandedRows);
        await to({ groups: sections, expandedIds: ["p2"] });
        await expectRowTexts(ref, secondExpandedRows);
        expect(expanderCount()).toBe(5);
    });

    it("keeps a nested row expanded when sections arrive around it", async () => {
        const { ref, to } = await renderFixture({ groups: firstSectionOnly, expandedIds: ["p1"] });
        await expectRowTexts(ref, soloSectionRows);
        await to({ groups: sections, expandedIds: ["p1"] });
        await expectRowTexts(ref, firstExpandedRows);
        await to({ groups: [firstSection, mirrorSection], expandedIds: ["p3"] });
        await expectRowTexts(ref, ["H:One", "Parent 1", "Solo 1", ...mirrorExpandedRows]);
        await to({ groups: [mirrorSection], expandedIds: ["p3"] });
        await expectRowTexts(ref, mirrorExpandedRows);
    });

    it("keeps a later section expanded when the section before it is dropped", async () => {
        const { ref, to } = await renderFixture({ groups: sections, expandedIds: ["p2"] });
        await expectRowTexts(ref, secondExpandedRows);
        await to({ groups: secondSectionOnly, expandedIds: ["p2"] });
        await expectRowTexts(ref, secondOnlyRows);
    });

    it("collapses a nested row when expandedIds empties and reports it", async () => {
        const onExpandedChange = vi.fn();
        const from = { groups: firstSectionOnly, expandedIds: ["p1"] };
        const { ref, to } = await renderFixture(from, { onExpandedChange });
        await to({ groups: sections, expandedIds: [] });
        await expectRowTexts(ref, collapsedRows);

        await waitFor(() => {
            expect(onExpandedChange).toHaveBeenLastCalledWith([]);
        });
    });

    it("expands and reports the row whose sectioned expander is clicked", async () => {
        const ref = createRef<Gtk.ListView>();
        await render(<StatefulSections listRef={ref} />);
        await userEvent.click(expanderNamed("Parent 2"));
        await expectRowTexts(ref, secondExpandedRows);
    });
});
