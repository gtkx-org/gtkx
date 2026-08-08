import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkColumnView,
    GtkColumnViewColumn,
    GtkGridView,
    GtkListView,
    GtkNoSelection,
    GtkScrolledWindow,
    GtkSignalListItemFactory,
    GtkStringList,
} from "@gtkx/jsx/gtk";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { getWidgetText, render, screen, userEvent, waitFor } from "../src/index.js";

type ScrolledFixture = {
    window: Gtk.ScrolledWindow;
    adjustment: Gtk.Adjustment;
    count: number;
};

const ROW_COUNT = 400;
const GRID_ROW_COUNT = 4000;
const ROW_PREFIX = "row ";
const ROW_PATTERN = /^row \d+$/;

const makeStrings = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `${ROW_PREFIX}${String(index)}`);

const setupRow = (object: GObject.Object) => {
    if (object instanceof Gtk.ListItem) {
        object.setChild(Gtk.Label.new(""));
    }
};

const bindRow = (object: GObject.Object) => {
    const item = object instanceof Gtk.ListItem ? object : null;
    const child = item?.getChild();
    const value = item?.getItem();

    if (child instanceof Gtk.Label && value instanceof Gtk.StringObject) {
        child.setText(value.getString());
    }
};

const rowFactory = () => <GtkSignalListItemFactory onSetup={setupRow} onBind={bindRow} />;
const rowModel = (count: number) => <GtkNoSelection model={<GtkStringList strings={makeStrings(count)} />} />;

const traverseWidgets = function* (root: Gtk.Widget): Generator<Gtk.Widget> {
    yield root;
    let child = root.getFirstChild();

    while (child) {
        yield* traverseWidgets(child);
        child = child.getNextSibling();
    }
};

const getMappedRows = (root: Gtk.Widget): number[] => {
    const indexes: number[] = [];

    for (const node of traverseWidgets(root)) {
        if (node instanceof Gtk.Label && node.getMapped() && node.getText().startsWith(ROW_PREFIX)) {
            indexes.push(Number(node.getText().slice(ROW_PREFIX.length)));
        }
    }

    return indexes.toSorted((left, right) => left - right);
};

const renderScrolled = async (view: ReactNode, count: number): Promise<ScrolledFixture> => {
    const ref = createRef<Gtk.ScrolledWindow>();

    await render(
        <GtkScrolledWindow ref={ref} minContentHeight={400} minContentWidth={300}>
            {view}
        </GtkScrolledWindow>,
    );

    const window = ref.current as Gtk.ScrolledWindow;
    const adjustment = window.getVadjustment();

    await waitFor(() => {
        expect(adjustment.getUpper()).toBeGreaterThan(adjustment.getPageSize());
        expect(getMappedRows(window)).toContain(0);
    });

    return { window, adjustment, count };
};

const getFindableRows = (): number[] =>
    screen
        .queryAllByText(ROW_PATTERN)
        .map((widget) => Number(getWidgetText(widget)?.slice(ROW_PREFIX.length)))
        .toSorted((left, right) => left - right);

const renderListView = (): Promise<ScrolledFixture> =>
    renderScrolled(<GtkListView model={rowModel(ROW_COUNT)} factory={rowFactory()} />, ROW_COUNT);

const expectRowsAt = (fixture: ScrolledFixture, value: number): void => {
    const rowHeight = fixture.adjustment.getUpper() / fixture.count;
    const mapped = getMappedRows(fixture.window);
    expect(fixture.adjustment.getValue()).toBe(value);
    expect(mapped.length).toBeGreaterThan(0);
    expect(mapped[0]).toBeGreaterThanOrEqual(Math.floor(value / rowHeight) - 1);
    expect(mapped[0]).toBeLessThanOrEqual(Math.floor(value / rowHeight) + 1);
};

describe("userEvent.scroll over virtualized views", () => {
    it("moves a Gtk.ColumnView past its realized band and back to the first row", async () => {
        const fixture = await renderScrolled(
            <GtkColumnView model={rowModel(ROW_COUNT)}>
                <GtkColumnViewColumn title="Name" expand factory={rowFactory()} />
            </GtkColumnView>,
            ROW_COUNT,
        );

        await userEvent.scroll(fixture.window, { y: 12_000 });
        expectRowsAt(fixture, 12_000);
        expect(getMappedRows(fixture.window)).not.toContain(0);
        await userEvent.scroll(fixture.window, { y: -12_000 });
        expectRowsAt(fixture, 0);
        expect(getMappedRows(fixture.window)[0]).toBe(0);
    });

    it("moves a Gtk.ListView past its realized band", async () => {
        const fixture = await renderListView();
        await userEvent.scroll(fixture.window, { y: 6000 });
        expectRowsAt(fixture, 6000);
        expect(getMappedRows(fixture.window)).not.toContain(0);
    });

    it("moves a Gtk.GridView past its realized band", async () => {
        const fixture = await renderScrolled(
            <GtkGridView model={rowModel(GRID_ROW_COUNT)} factory={rowFactory()} />,
            GRID_ROW_COUNT,
        );

        const before = getMappedRows(fixture.window);
        await userEvent.scroll(fixture.window, { y: 8000 });
        const after = getMappedRows(fixture.window);
        expect(fixture.adjustment.getValue()).toBe(8000);
        expect(after.length).toBeGreaterThan(0);
        expect(after[0]).toBeGreaterThan(before.at(-1) as number);
        expect(after).not.toContain(0);
    });

    it("stops at the end of the range instead of looping forever", async () => {
        const fixture = await renderListView();
        const limit = fixture.adjustment.getUpper() - fixture.adjustment.getPageSize();
        await userEvent.scroll(fixture.window, { y: 1_000_000 });
        expect(fixture.adjustment.getValue()).toBe(limit);
        expect(getMappedRows(fixture.window).at(-1)).toBe(ROW_COUNT - 1);
    });
});

describe("queries over a virtualized view", () => {
    it("matches exactly the rows a Gtk.ListView shows, never a recycled list item", async () => {
        const fixture = await renderListView();
        expect(screen.queryAllByText("row 0")).toHaveLength(1);
        await userEvent.scroll(fixture.window, { y: 6000 });

        await waitFor(() => {
            expect(getMappedRows(fixture.window)).not.toContain(0);
        });

        expect(getFindableRows()).toEqual(getMappedRows(fixture.window));
        expect(screen.queryAllByText("row 0")).toHaveLength(0);
    });

    it("brings a row back into reach once it is scrolled into view again", async () => {
        const fixture = await renderListView();
        await userEvent.scroll(fixture.window, { y: 6000 });

        await waitFor(() => {
            expect(getFindableRows()).not.toContain(0);
        });

        await userEvent.scroll(fixture.window, { y: -6000 });
        expect(getFindableRows()).toContain(0);
        expect(await screen.findByText("row 0")).toBeDefined();
    });
});
