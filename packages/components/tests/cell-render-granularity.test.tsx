import type { Column, Item } from "@gtkx/components";
import { ColumnView, ListView } from "@gtkx/components";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkInscription, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Row = { name: string };

const ROWS = 5000;
const COLUMNS = 6;
const counts = { cells: 0 };

const rows: Item<Row>[] = Array.from({ length: ROWS }, (_, index) => ({
    id: `r${String(index)}`,
    value: { name: `row ${String(index)}` },
}));

const columns: Column<Row>[] = Array.from({ length: COLUMNS }, (_, index) => ({
    id: `c${String(index)}`,
    title: `Col ${String(index)}`,
    renderCell: ({ item }) => {
        counts.cells += 1;

        return <GtkInscription text={`${item.name}/${String(index)}`} />;
    },
}));

const nextTick = (widget: Gtk.Widget): Promise<void> =>
    new Promise((resolve) => {
        widget.addTickCallback(() => {
            resolve();

            return GLib.SOURCE_REMOVE;
        });
    });

const pumpFrames = async (widget: Gtk.Widget, times: number): Promise<void> => {
    for (let index = 0; index < times; index++) {
        await nextTick(widget);
    }
};

const countCellWidgets = (root: Gtk.Widget, name: string): number => {
    let count = root.getName() === name ? 1 : 0;

    for (let child = root.getFirstChild(); child; child = child.getNextSibling()) {
        count += countCellWidgets(child, name);
    }

    return count;
};

const pageDown = async (scroller: Gtk.ScrolledWindow, widget: Gtk.Widget): Promise<void> => {
    const adjustment = scroller.getVadjustment();

    adjustment.setValue(
        Math.min(adjustment.getUpper() - adjustment.getPageSize(), adjustment.getValue() + adjustment.getPageSize()),
    );

    await pumpFrames(widget, 2);
};

const ColumnHarness = () => (
    <ScrollWrapper minContentHeight={400} minContentWidth={800}>
        <ColumnView<Row> name="cv" items={rows} columns={columns} estimatedItemHeight={32} />
    </ScrollWrapper>
);

vi.setConfig({ testTimeout: 120_000 });

describe("cell render granularity", () => {
    it("keeps a page scroll proportional to the cells it rebinds, not to the cells on screen", async () => {
        await render(<ColumnHarness />);
        const view = await screen.findByName("cv");
        const scroller = view.getAncestor(Gtk.ScrolledWindow.prototype.__type__) as Gtk.ScrolledWindow;
        await pumpFrames(view, 4);
        const live = countCellWidgets(view, "GtkColumnViewCellWidget");
        expect(live).toBeGreaterThan(50);
        counts.cells = 0;

        for (let page = 0; page < 5; page++) {
            await pageDown(scroller, view);
        }

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

        await render(
            <ScrollWrapper minContentHeight={400} minContentWidth={800}>
                <ListView<Row>
                    ref={ref}
                    items={rows}
                    estimatedItemHeight={32}
                    renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
                />
            </ScrollWrapper>,
        );

        const view = ref.current as Gtk.ListView;
        const scroller = view.getAncestor(Gtk.ScrolledWindow.prototype.__type__) as Gtk.ScrolledWindow;
        await pumpFrames(view, 4);
        const before = countCellWidgets(view, "GtkListItemWidget");

        for (let page = 0; page < 5; page++) {
            await pageDown(scroller, view);
        }

        expect(countCellWidgets(view, "GtkListItemWidget")).toBeLessThanOrEqual(before + COLUMNS);
    });
});
