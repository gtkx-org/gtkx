import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { pumpFrames, scrollPages } from "./helpers/frame-pump.js";
import { inscriptionColumns, largeListView, largeRows, type Row } from "./helpers/large-rows.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

const COLUMNS = 6;
const PAGES = 5;
const counts = { cells: 0 };

const columns = inscriptionColumns(COLUMNS, () => {
    counts.cells += 1;
});

const countCellWidgets = (root: Gtk.Widget, name: string): number => {
    let count = root.getName() === name ? 1 : 0;

    for (let child = root.getFirstChild(); child; child = child.getNextSibling()) {
        count += countCellWidgets(child, name);
    }

    return count;
};

const ColumnHarness = () => (
    <ScrollWrapper minContentHeight={400} minContentWidth={800}>
        <ColumnView<Row> name="cv" items={largeRows} columns={columns} estimatedItemHeight={32} />
    </ScrollWrapper>
);

vi.setConfig({ testTimeout: 120_000 });

describe("cell render granularity", () => {
    it("keeps a page scroll proportional to the cells it rebinds, not to the cells on screen", async () => {
        await render(<ColumnHarness />);
        const view = await screen.findByName("cv");
        await pumpFrames(view, 4);
        const live = countCellWidgets(view, "GtkColumnViewCellWidget");
        expect(live).toBeGreaterThan(50);
        counts.cells = 0;
        await scrollPages(view, PAGES);
        expect(counts.cells).toBeLessThan(live);
    });

    it("renders every visible cell exactly once on mount", async () => {
        counts.cells = 0;
        await render(<ColumnHarness />);
        const view = await screen.findByName("cv");
        await pumpFrames(view, 4);
        const live = countCellWidgets(view, "GtkColumnViewCellWidget");
        expect(counts.cells).toBe(live);
    });
});

describe("cell widget reuse", () => {
    it("reuses the same list item widget when a row scrolls out of view and another takes its place", async () => {
        const ref = createRef<Gtk.ListView>();
        await render(largeListView(ref));
        const view = ref.current as Gtk.ListView;
        await pumpFrames(view, 4);
        const before = countCellWidgets(view, "GtkListItemWidget");
        await scrollPages(view, PAGES);
        expect(countCellWidgets(view, "GtkListItemWidget")).toBeLessThanOrEqual(before + COLUMNS);
    });
});
