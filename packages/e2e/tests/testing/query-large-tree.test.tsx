import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkScrolledWindow,
    GtkStack,
    GtkStackPage,
} from "@gtkx/jsx/gtk";
import { act, render, screen } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const MAPPED_ROWS = 40;
const UNMAPPED_PAGES = 200;

const rowName = (index: number): string => `Cache entry ${String(index)}`;

const Row = ({ index }: { index: number }): ReactNode => (
    <GtkBox accessibleRole={Gtk.AccessibleRole.ROW} accessibleLabel={rowName(index)}>
        <GtkCheckButton active accessibleLabel={`Include ${rowName(index)}`} />
        <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand>
            <GtkLabel xalign={0} label={rowName(index)} />
            <GtkLabel xalign={0} cssClasses={["caption"]} label="downloaded again" />
        </GtkBox>
        <GtkLabel label={`${String(index)} KiB`} />
        <GtkButton label="Review" />
    </GtkBox>
);

const MappedRows = (): ReactNode =>
    Array.from({ length: MAPPED_ROWS }, (_, index) => <Row key={index} index={index} />);

const UnmappedPages = (): ReactNode =>
    Array.from({ length: UNMAPPED_PAGES }, (_, index) => (
        <GtkStackPage key={index} name={`unmapped-${String(index)}`}>
            <Row index={MAPPED_ROWS + index} />
        </GtkStackPage>
    ));

const ReviewLane = ({ popoverRef }: { popoverRef: RefObject<Gtk.Popover | null> }): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel label="Cleanup" cssClasses={["title-1"]} />
        <GtkScrolledWindow minContentHeight={300} vexpand>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <MappedRows />
            </GtkBox>
        </GtkScrolledWindow>
        <GtkStack>
            <GtkStackPage name="visible">
                <GtkLabel label="Nothing selected" />
            </GtkStackPage>
            <UnmappedPages />
            <GtkStackPage name="popover">
                <GtkMenuButton label="Open">
                    <GtkPopover ref={popoverRef}>
                        <GtkLabel label="Inside the popover" />
                    </GtkPopover>
                </GtkMenuButton>
            </GtkStackPage>
        </GtkStack>
    </GtkBox>
);

const renderReviewLane = async (): Promise<Gtk.Popover> => {
    const popoverRef = createRef<Gtk.Popover>();
    await render(<ReviewLane popoverRef={popoverRef} />);

    return popoverRef.current as Gtk.Popover;
};

const settle = async (action: () => void): Promise<void> => {
    await act(async () => {
        action();
        await Promise.resolve();
    });
};

describe("queries over a large window that is mostly unmapped", () => {
    it("finds a mapped row by role and name", async () => {
        await renderReviewLane();
        expect(screen.getByRole(Gtk.AccessibleRole.ROW, { name: rowName(7) })).toHaveAccessibleName(rowName(7));
    });

    it("names every mapped button through its labelled-by relation", async () => {
        await renderReviewLane();
        expect(screen.getAllByRole(Gtk.AccessibleRole.BUTTON, { name: "Review" })).toHaveLength(MAPPED_ROWS);
    });

    it("excludes rows on unmapped pages", async () => {
        await renderReviewLane();
        expect(screen.queryAllByRole(Gtk.AccessibleRole.ROW, { name: rowName(MAPPED_ROWS) })).toHaveLength(0);
    });

    it("reaches a popover raised from an unmapped page", async () => {
        const popover = await renderReviewLane();

        await settle(() => {
            popover.popup();
        });

        expect(await screen.findByText("Inside the popover")).toBeRooted();
    });

    it("throws for a row that only exists on an unmapped page", async () => {
        await renderReviewLane();
        expect(() => screen.getByRole(Gtk.AccessibleRole.ROW, { name: rowName(MAPPED_ROWS) })).toThrow();
    });
});
