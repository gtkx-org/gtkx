import { SizeGroup } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";

const NARROW_WIDTH = 24;
const WIDE_WIDTH = 160;
const SHORT_HEIGHT = 10;
const TALL_HEIGHT = 80;

const naturalWidth = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.HORIZONTAL, -1)[1];

const naturalHeight = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.VERTICAL, -1)[1];

const GroupedLabels = ({ count, mode }: { count: 0 | 1 | 2; mode?: Gtk.SizeGroupMode }) => (
    <GtkBox>
        <SizeGroup mode={mode}>
            {count >= 1 && (
                <SizeGroup.Child component={GtkLabel} widthRequest={NARROW_WIDTH}>
                    A
                </SizeGroup.Child>
            )}
            {count >= 2 && (
                <SizeGroup.Child component={GtkLabel} widthRequest={WIDE_WIDTH}>
                    B
                </SizeGroup.Child>
            )}
        </SizeGroup>
    </GtkBox>
);

const expectGroupedWide = async (app: ReactElement) => {
    const result = await render(app);
    expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
    expect(naturalWidth(screen.getByText("B"))).toBe(WIDE_WIDTH);
    return result;
};

const renderGroupOfTwo = () => expectGroupedWide(<GroupedLabels count={2} mode={Gtk.SizeGroupMode.HORIZONTAL} />);

describe("SizeGroup members", () => {
    it("stretches every member to the widest member's natural size", async () => {
        await renderGroupOfTwo();
    });

    it("stops sharing size with a widget once it leaves the group", async () => {
        const { rerender } = await renderGroupOfTwo();

        await rerender(<GroupedLabels count={1} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(NARROW_WIDTH);
    });

    it("clears membership when the group empties", async () => {
        const { rerender } = await renderGroupOfTwo();

        await rerender(<GroupedLabels count={0} mode={Gtk.SizeGroupMode.HORIZONTAL} />);

        await rerender(<GroupedLabels count={1} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(NARROW_WIDTH);
    });
});

describe("SizeGroup mode", () => {
    it("applies and updates the mode prop", async () => {
        const GroupedLabelsWithMode = ({ mode }: { mode: Gtk.SizeGroupMode }): ReactNode => (
            <GtkBox>
                <SizeGroup mode={mode}>
                    <SizeGroup.Child component={GtkLabel} widthRequest={NARROW_WIDTH} heightRequest={TALL_HEIGHT}>
                        A
                    </SizeGroup.Child>
                    <SizeGroup.Child component={GtkLabel} widthRequest={WIDE_WIDTH} heightRequest={SHORT_HEIGHT}>
                        B
                    </SizeGroup.Child>
                </SizeGroup>
            </GtkBox>
        );

        const { rerender } = await render(<GroupedLabelsWithMode mode={Gtk.SizeGroupMode.HORIZONTAL} />);
        expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
        expect(naturalHeight(screen.getByText("A"))).toBe(TALL_HEIGHT);
        expect(naturalHeight(screen.getByText("B"))).not.toBe(naturalHeight(screen.getByText("A")));

        await rerender(<GroupedLabelsWithMode mode={Gtk.SizeGroupMode.BOTH} />);
        expect(naturalHeight(screen.getByText("A"))).toBe(TALL_HEIGHT);
        expect(naturalHeight(screen.getByText("B"))).toBe(TALL_HEIGHT);
    });
});

describe("SizeGroup across subtrees", () => {
    it("groups widgets living in separate containers", async () => {
        const App = () => (
            <GtkBox>
                <SizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                    <GtkFrame label="Frame A">
                        <SizeGroup.Child component={GtkLabel} widthRequest={NARROW_WIDTH}>
                            A
                        </SizeGroup.Child>
                    </GtkFrame>
                    <GtkFrame label="Frame B">
                        <SizeGroup.Child component={GtkLabel} widthRequest={WIDE_WIDTH}>
                            B
                        </SizeGroup.Child>
                    </GtkFrame>
                </SizeGroup>
            </GtkBox>
        );

        await expectGroupedWide(<App />);

        expect(within(screen.getByRole(Gtk.AccessibleRole.GROUP, { name: /Frame A/ })).getByText("A")).toBeDefined();
        expect(within(screen.getByRole(Gtk.AccessibleRole.GROUP, { name: /Frame B/ })).getByText("B")).toBeDefined();
    });
});

describe("SizeGroup.Child", () => {
    it("forwards the caller's ref while registering the widget", async () => {
        const externalRef: { current: Gtk.Label | null } = { current: null };

        const App = () => (
            <GtkBox>
                <SizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                    <SizeGroup.Child component={GtkLabel} ref={externalRef} widthRequest={NARROW_WIDTH}>
                        A
                    </SizeGroup.Child>
                    <SizeGroup.Child component={GtkLabel} widthRequest={WIDE_WIDTH}>
                        B
                    </SizeGroup.Child>
                </SizeGroup>
            </GtkBox>
        );

        await expectGroupedWide(<App />);
        expect(externalRef.current).toBe(screen.getByText("A"));
    });

    it("throws when used outside a <SizeGroup>", async () => {
        const Orphan = () => <SizeGroup.Child component={GtkLabel}>orphan</SizeGroup.Child>;

        await expect(render(<Orphan />)).rejects.toThrow("<SizeGroup.Child> must be a child of <SizeGroup>");
    });
});
