import { SizeGroup } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import type { ReactNode, RefCallback } from "react";
import { describe, expect, it } from "vitest";

const NARROW_WIDTH = 24;
const WIDE_WIDTH = 160;
const SHORT_HEIGHT = 10;
const TALL_HEIGHT = 80;

const naturalWidth = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.HORIZONTAL, -1)[1];

const naturalHeight = (widget: Gtk.Widget): number => widget.measure(Gtk.Orientation.VERTICAL, -1)[1];

const MeasuredLabel = ({
    groupRef,
    label,
    widthRequest,
    heightRequest,
}: {
    groupRef: RefCallback<Gtk.Widget>;
    label: string;
    widthRequest: number;
    heightRequest?: number;
}) => <GtkLabel ref={groupRef} label={label} widthRequest={widthRequest} heightRequest={heightRequest} />;

const GroupedLabels = ({ count, mode }: { count: 0 | 1 | 2; mode?: Gtk.SizeGroupMode }) => (
    <GtkBox>
        <SizeGroup mode={mode}>
            {(ref) => (
                <>
                    {count >= 1 && <MeasuredLabel groupRef={ref} label="A" widthRequest={NARROW_WIDTH} />}
                    {count >= 2 && <MeasuredLabel groupRef={ref} label="B" widthRequest={WIDE_WIDTH} />}
                </>
            )}
        </SizeGroup>
    </GtkBox>
);

const renderGroupOfTwo = async () => {
    const { rerender } = await render(<GroupedLabels count={2} mode={Gtk.SizeGroupMode.HORIZONTAL} />);
    expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
    expect(naturalWidth(screen.getByText("B"))).toBe(WIDE_WIDTH);
    return { rerender };
};

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
                    {(ref) => (
                        <>
                            <MeasuredLabel
                                groupRef={ref}
                                label="A"
                                widthRequest={NARROW_WIDTH}
                                heightRequest={TALL_HEIGHT}
                            />
                            <MeasuredLabel
                                groupRef={ref}
                                label="B"
                                widthRequest={WIDE_WIDTH}
                                heightRequest={SHORT_HEIGHT}
                            />
                        </>
                    )}
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
                    {(ref) => (
                        <>
                            <GtkFrame label="Frame A">
                                <MeasuredLabel groupRef={ref} label="A" widthRequest={NARROW_WIDTH} />
                            </GtkFrame>
                            <GtkFrame label="Frame B">
                                <MeasuredLabel groupRef={ref} label="B" widthRequest={WIDE_WIDTH} />
                            </GtkFrame>
                        </>
                    )}
                </SizeGroup>
            </GtkBox>
        );

        await render(<App />);

        expect(naturalWidth(screen.getByText("A"))).toBe(WIDE_WIDTH);
        expect(naturalWidth(screen.getByText("B"))).toBe(WIDE_WIDTH);

        expect(within(screen.getByRole(Gtk.AccessibleRole.GROUP, { name: /Frame A/ })).getByText("A")).toBeDefined();
        expect(within(screen.getByRole(Gtk.AccessibleRole.GROUP, { name: /Frame B/ })).getByText("B")).toBeDefined();
    });
});
