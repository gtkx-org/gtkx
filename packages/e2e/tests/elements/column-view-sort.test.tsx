import type { ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnViewColumn, GtkCustomSorter, GtkMultiSelection } from "@gtkx/jsx/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { attachClickGesture } from "../helpers/click-gesture.js";
import { ITEM_NAMES, itemFactory, renderColumnView } from "../helpers/list-view-render.js";

const NAME_TITLE = "Name";
const SIZE_TITLE = "Size";
const PLAIN_TITLE = "Plain";

const columnElements = (): ReactNode => (
    <>
        <GtkColumnViewColumn title={NAME_TITLE} factory={itemFactory()} sorter={<GtkCustomSorter />} />
        <GtkColumnViewColumn title={SIZE_TITLE} factory={itemFactory()} sorter={<GtkCustomSorter />} />
        <GtkColumnViewColumn title={PLAIN_TITLE} factory={itemFactory()} />
    </>
);

const renderColumns = (onActivate?: () => void): Promise<RefObject<Gtk.ColumnView | null>> =>
    renderColumnView(
        <GtkMultiSelection model={Gtk.StringList.new(ITEM_NAMES)} />,
        columnElements(),
        onActivate === undefined ? {} : { isSingleClickActivating: true, onActivate },
    );

const sorterFrom = (view: Gtk.ColumnView | null): Gtk.ColumnViewSorter => {
    const sorter = view?.getSorter();

    if (!(sorter instanceof Gtk.ColumnViewSorter)) {
        throw new TypeError("The column view has no column sorter");
    }

    return sorter;
};

const columnAt = (view: Gtk.ColumnView | null, index: number): Gtk.ColumnViewColumn => {
    const column = view?.getColumns().getItem(index);

    if (!(column instanceof Gtk.ColumnViewColumn)) {
        throw new TypeError(`No column at index ${String(index)}`);
    }

    return column;
};

const headerFor = (title: string): Gtk.Widget => screen.getByRole(Gtk.AccessibleRole.COLUMN_HEADER, { name: title });

const headerRowFor = (title: string): Gtk.Widget => {
    const row = headerFor(title).getParent();

    if (row === null) {
        throw new TypeError("The column header has no row");
    }

    return row;
};

const expectUnsorted = (ref: RefObject<Gtk.ColumnView | null>): void => {
    expect(sorterFrom(ref.current).getPrimarySortColumn()).toBeNull();
    expect((ref.current?.getModel() as Gtk.MultiSelection).getSelection().getSize()).toBe(0n);
};

const clickHeaders = async (titles: string[]): Promise<RefObject<Gtk.ColumnView | null>> => {
    const ref = await renderColumns();

    for (const title of titles) {
        await userEvent.click(headerFor(title));
    }

    return ref;
};

describe("clicking a column view header", () => {
    it("sorts by the clicked column, ascending", async () => {
        const ref = await clickHeaders([NAME_TITLE]);
        const sorter = sorterFrom(ref.current);
        expect(sorter.getPrimarySortColumn()).toBe(columnAt(ref.current, 0));
        expect(sorter.getPrimarySortOrder()).toBe(Gtk.SortType.ASCENDING);
    });

    it("inverts the order on a second click", async () => {
        const ref = await clickHeaders([NAME_TITLE, NAME_TITLE]);
        const sorter = sorterFrom(ref.current);
        expect(sorter.getPrimarySortColumn()).toBe(columnAt(ref.current, 0));
        expect(sorter.getPrimarySortOrder()).toBe(Gtk.SortType.DESCENDING);
    });

    it("moves the primary column when a different header is clicked", async () => {
        const ref = await clickHeaders([NAME_TITLE, SIZE_TITLE]);
        const sorter = sorterFrom(ref.current);
        expect(sorter.getPrimarySortColumn()).toBe(columnAt(ref.current, 1));
        expect(sorter.getPrimarySortOrder()).toBe(Gtk.SortType.ASCENDING);
    });

    it("sorts when the label inside the header is clicked", async () => {
        const ref = await renderColumns();
        await userEvent.click(screen.getByText(SIZE_TITLE));
        expect(sorterFrom(ref.current).getPrimarySortColumn()).toBe(columnAt(ref.current, 1));
    });

    it("inverts the order once per press on a double click", async () => {
        const ref = await renderColumns();
        await userEvent.dblClick(headerFor(NAME_TITLE));
        expect(sorterFrom(ref.current).getPrimarySortOrder()).toBe(Gtk.SortType.DESCENDING);
    });

    it("leaves the sorter alone for a column with no sorter", async () => {
        expectUnsorted(await clickHeaders([PLAIN_TITLE]));
    });

    it("fires a click gesture the header itself carries", async () => {
        const ref = await renderColumns();
        const header = headerFor(NAME_TITLE);
        const counts = attachClickGesture(header);
        await userEvent.click(header);
        expect(counts).toEqual({ pressed: 1, released: 1 });
        expect(sorterFrom(ref.current).getPrimarySortColumn()).toBe(columnAt(ref.current, 0));
    });
});

describe("clicking the row that carries the column headers", () => {
    it("leaves the sorter and the selection alone", async () => {
        const ref = await renderColumns();
        await userEvent.click(headerRowFor(NAME_TITLE));
        expectUnsorted(ref);
    });

    it("does not activate the view that activates on a single click", async () => {
        const onActivate = vi.fn();
        await renderColumns(onActivate);
        await userEvent.click(headerRowFor(NAME_TITLE));
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("leaves the sorter alone when it takes a pointer click token", async () => {
        const ref = await renderColumns();
        await userEvent.pointer(headerRowFor(NAME_TITLE), "click");
        expectUnsorted(ref);
    });
});
