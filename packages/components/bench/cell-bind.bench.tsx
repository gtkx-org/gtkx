import type { ColumnViewColumn, ListItem } from "@gtkx/components";
import type { ReactNode, RefCallback } from "react";
import { ColumnView, ListView } from "@gtkx/components";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkInscription, GtkLabel } from "@gtkx/jsx/gtk";
import { bench, describe } from "vitest";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { ScrollWrapper } from "../tests/helpers/scroll-wrapper.js";

type Row = { name: string };
type BuildView = (ref: RefCallback<Gtk.Widget>) => ReactNode;

const ROWS = 5000;
const PAGES = 5;
const COLUMN_COUNTS = [1, 6];

const rows: ListItem<Row>[] = Array.from({ length: ROWS }, (_, index) => ({
    id: `r${String(index)}`,
    value: { name: `row ${String(index)}` },
}));

const makeColumns = (count: number): ColumnViewColumn<Row>[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `c${String(index)}`,
        title: `Col ${String(index)}`,
        renderCell: ({ item }) => <GtkInscription text={`${item.name}/${String(index)}`} />,
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

const scrollPages = async (widget: Gtk.Widget, pages: number): Promise<void> => {
    const scroller = widget.getAncestor(Gtk.ScrolledWindow.prototype.__type__) as Gtk.ScrolledWindow | null;

    if (scroller === null) {
        throw new Error("bench harness produced no scrolled window");
    }

    const adjustment = scroller.getVadjustment();

    for (let page = 0; page < pages; page++) {
        adjustment.setValue(
            Math.min(
                adjustment.getUpper() - adjustment.getPageSize(),
                adjustment.getValue() + adjustment.getPageSize(),
            ),
        );

        await pumpFrames(widget, 2);
    }
};

const runScrollBench = (build: BuildView) => async (): Promise<void> => {
    const held: { view: Gtk.Widget | null } = { view: null };

    await render(build((widget) => {
        held.view = widget;
    }));

    const view = held.view;

    if (view === null) {
        throw new Error("bench harness produced no view");
    }

    await pumpFrames(view, 4);
    await scrollPages(view, PAGES);
    await cleanup();
};

const columnView = (count: number): BuildView => (ref) => (
    <ScrollWrapper minContentHeight={400} minContentWidth={800}>
        <ColumnView<Row> ref={ref} items={rows} columns={makeColumns(count)} estimatedItemHeight={32} />
    </ScrollWrapper>
);

const listView: BuildView = (ref) => (
    <ScrollWrapper minContentHeight={400} minContentWidth={800}>
        <ListView<Row>
            ref={ref}
            items={rows}
            estimatedItemHeight={32}
            renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
        />
    </ScrollWrapper>
);

describe("cell binding", () => {
    for (const count of COLUMN_COUNTS) {
        bench(
            `scroll ${String(PAGES)} pages of a ${String(count)}-column view over ${String(ROWS)} rows`,
            runScrollBench(columnView(count)),
        );
    }

    bench(`scroll ${String(PAGES)} pages of a list view over ${String(ROWS)} rows`, runScrollBench(listView));
});
