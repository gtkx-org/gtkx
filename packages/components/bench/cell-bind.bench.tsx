import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode, RefCallback } from "react";
import { ColumnView } from "@gtkx/components";
import { cleanup, render } from "@gtkx/testing/internal";
import { bench, describe } from "vitest";
import { pumpFrames, scrollPages } from "../tests/helpers/frame-pump.js";
import { inscriptionColumns, largeListView, largeRows, type Row } from "../tests/helpers/large-rows.js";
import { ScrollWrapper } from "../tests/helpers/scroll-wrapper.js";

type BuildView = (ref: RefCallback<Gtk.Widget>) => ReactNode;

const ROWS = largeRows.length;
const PAGES = 5;
const COLUMN_COUNTS = [1, 6];

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
        <ColumnView<Row> ref={ref} items={largeRows} columns={inscriptionColumns(count)} estimatedItemHeight={32} />
    </ScrollWrapper>
);

const listView: BuildView = (ref) => largeListView(ref);

describe("cell binding", () => {
    for (const count of COLUMN_COUNTS) {
        bench(
            `scroll ${String(PAGES)} pages of a ${String(count)}-column view over ${String(ROWS)} rows`,
            runScrollBench(columnView(count)),
        );
    }

    bench(`scroll ${String(PAGES)} pages of a list view over ${String(ROWS)} rows`, runScrollBench(listView));
});
