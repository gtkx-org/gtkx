import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkSizeGroup } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import { type ReactElement, useState } from "react";
import { describe, expect, it } from "vitest";

type GroupedLabelsProps = {
    count: 0 | 1 | 2;
    mode?: Gtk.SizeGroupMode;
};

type SizedLabelsProps = {
    mode: Gtk.SizeGroupMode;
};

const NARROW_WIDTH = 24;
const WIDE_WIDTH = 160;
const SHORT_HEIGHT = 10;
const TALL_HEIGHT = 80;

const naturalWidth = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.HORIZONTAL, -1)[1];
const naturalHeight = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.VERTICAL, -1)[1];
const grouped = (...widgets: (Gtk.Widget | null)[]): Gtk.Widget[] => widgets.filter((widget) => widget !== null);

function GroupedLabels({ count, mode }: GroupedLabelsProps) {
    const [a, setA] = useState<Gtk.Label | null>(null);
    const [b, setB] = useState<Gtk.Label | null>(null);

    return (
        <GtkBox>
            <GtkSizeGroup mode={mode} widgets={grouped(count >= 1 ? a : null, count >= 2 ? b : null)} />
            {count >= 1 && (
                <GtkLabel ref={setA} widthRequest={NARROW_WIDTH}>
                    A
                </GtkLabel>
            )}
            {count >= 2 && (
                <GtkLabel ref={setB} widthRequest={WIDE_WIDTH}>
                    B
                </GtkLabel>
            )}
        </GtkBox>
    );
}

function SizedLabels({ mode }: SizedLabelsProps) {
    const [a, setA] = useState<Gtk.Label | null>(null);
    const [b, setB] = useState<Gtk.Label | null>(null);

    return (
        <GtkBox>
            <GtkSizeGroup mode={mode} widgets={grouped(a, b)} />
            <GtkLabel ref={setA} widthRequest={NARROW_WIDTH} heightRequest={TALL_HEIGHT}>
                A
            </GtkLabel>
            <GtkLabel ref={setB} widthRequest={WIDE_WIDTH} heightRequest={SHORT_HEIGHT}>
                B
            </GtkLabel>
        </GtkBox>
    );
}

function FramedLabels() {
    const [a, setA] = useState<Gtk.Label | null>(null);
    const [b, setB] = useState<Gtk.Label | null>(null);

    return (
        <GtkBox>
            <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL} widgets={grouped(a, b)} />
            <GtkFrame label="Frame A">
                <GtkLabel ref={setA} widthRequest={NARROW_WIDTH}>
                    A
                </GtkLabel>
            </GtkFrame>
            <GtkFrame label="Frame B">
                <GtkLabel ref={setB} widthRequest={WIDE_WIDTH}>
                    B
                </GtkLabel>
            </GtkFrame>
        </GtkBox>
    );
}

const expectGroupedWide = async (app: ReactElement) => {
    const result = await render(app);
    expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
    expect(naturalWidth(screen.getByText("B"))).toBe(WIDE_WIDTH);

    return result;
};

const expectGroupOfTwoIsWide = () => expectGroupedWide(<GroupedLabels count={2} mode={Gtk.SizeGroupMode.HORIZONTAL} />);

describe("render - SizeGroup widgets", () => {
    it("stretches every member to the widest member's natural size", async () => {
        await expectGroupOfTwoIsWide();
    });

    it("stops sharing size with a widget once it leaves the group", async () => {
        const { rerender } = await expectGroupOfTwoIsWide();
        await rerender(<GroupedLabels count={1} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(NARROW_WIDTH);
    });

    it("clears membership when the group empties", async () => {
        const { rerender } = await expectGroupOfTwoIsWide();
        await rerender(<GroupedLabels count={0} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        await rerender(<GroupedLabels count={1} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(NARROW_WIDTH);
    });

    it("groups widgets living in separate containers", async () => {
        await expectGroupedWide(<FramedLabels />);
        expect(within(screen.getByRole(Gtk.AccessibleRole.GROUP, { name: /Frame A/ })).getByText("A")).toBeDefined();
        expect(within(screen.getByRole(Gtk.AccessibleRole.GROUP, { name: /Frame B/ })).getByText("B")).toBeDefined();
    });
});

describe("render - SizeGroup mode", () => {
    it("applies and updates the mode prop", async () => {
        const { rerender } = await render(<SizedLabels mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
        expect(naturalHeight(screen.getByText("A"))).toBe(TALL_HEIGHT);
        expect(naturalHeight(screen.getByText("B"))).not.toBe(naturalHeight(screen.getByText("A")));
        await rerender(<SizedLabels mode={Gtk.SizeGroupMode.BOTH} />);
        expect(naturalHeight(screen.getByText("A"))).toBe(TALL_HEIGHT);
        expect(naturalHeight(screen.getByText("B"))).toBe(TALL_HEIGHT);
    });
});
