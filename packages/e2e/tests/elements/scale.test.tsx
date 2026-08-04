import type { ScaleMark } from "@gtkx/react/internal";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkScale } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const MIN_MAX_MARKS = [
    { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Min" },
    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Max" },
];

const MIN_MID_MAX_MARKS = [
    { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Min" },
    { value: 50, position: Gtk.PositionType.BOTTOM, markup: "Mid" },
    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Max" },
];

const ScaleWithMarks = ({ marks }: { marks?: ScaleMark[] }) => (
    <GtkScale adjustment={<GtkAdjustment value={0} lower={0} upper={100} />} marks={marks} />
);

const expectDefaultRange = (): void => {
    expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 0, min: 0, max: 100 } })).toBeTruthy();
};

const expectMarksTransition = async (initialMarks: ScaleMark[], updatedMarks: ScaleMark[]): Promise<void> => {
    const { rerender } = await render(<ScaleWithMarks marks={initialMarks} />);
    expectDefaultRange();
    await rerender(<ScaleWithMarks marks={updatedMarks} />);
    expectDefaultRange();
};

describe("render - Scale marks (1)", () => {
    it("creates Scale widget without marks", async () => {
        await render(<ScaleWithMarks />);
        expectDefaultRange();
    });

    it("creates Scale widget with marks", async () => {
        await render(<ScaleWithMarks marks={MIN_MID_MAX_MARKS} />);
        expectDefaultRange();
    });

    it("sets mark position", async () => {
        await render(
            <ScaleWithMarks
                marks={[
                    { value: 0, position: Gtk.PositionType.TOP, markup: "Top" },
                    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Bottom" },
                ]}
            />,
        );

        expectDefaultRange();
    });
});

describe("render - Scale marks (2)", () => {
    it("sets marks without labels", async () => {
        await render(
            <ScaleWithMarks
                marks={[
                    { value: 0, position: Gtk.PositionType.BOTTOM },
                    { value: 25, position: Gtk.PositionType.BOTTOM },
                    { value: 50, position: Gtk.PositionType.BOTTOM },
                    { value: 75, position: Gtk.PositionType.BOTTOM },
                    { value: 100, position: Gtk.PositionType.BOTTOM },
                ]}
            />,
        );

        expectDefaultRange();
    });

    it("updates marks when props change", async () => {
        await expectMarksTransition(
            [
                { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Start" },
                { value: 100, position: Gtk.PositionType.BOTTOM, markup: "End" },
            ],
            [
                { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Begin" },
                { value: 100, position: Gtk.PositionType.BOTTOM, markup: "End" },
            ],
        );
    });
});

describe("render - Scale marks (3)", () => {
    it("removes marks when array changes", async () => {
        await expectMarksTransition(MIN_MID_MAX_MARKS, MIN_MAX_MARKS);
    });

    it("handles inserting marks in the middle", async () => {
        await expectMarksTransition(MIN_MAX_MARKS, MIN_MID_MAX_MARKS);
    });
});
