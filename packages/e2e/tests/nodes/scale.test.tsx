import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkScale } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

type ScaleMark = { value: number; position: Gtk.PositionType; markup?: string | null };

const ScaleWithMarks = ({ marks, scaleRef }: { marks?: ScaleMark[]; scaleRef: RefObject<Gtk.Scale | null> }) => (
    <GtkScale ref={scaleRef} adjustment={<GtkAdjustment value={0} lower={0} upper={100} />} marks={marks} />
);

const expectDefaultRange = (scale: Gtk.Scale | null): void => {
    expect(scale).toBeInstanceOf(Gtk.Scale);
    const adjustment = scale?.getAdjustment();
    expect(adjustment?.getLower()).toBe(0);
    expect(adjustment?.getUpper()).toBe(100);
    expect(adjustment?.getValue()).toBe(0);
};

const MIN_MAX_MARKS = [
    { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Min" },
    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Max" },
];

const MIN_MID_MAX_MARKS = [
    { value: 0, position: Gtk.PositionType.BOTTOM, markup: "Min" },
    { value: 50, position: Gtk.PositionType.BOTTOM, markup: "Mid" },
    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Max" },
];

const expectMarksTransition = async (initialMarks: ScaleMark[], updatedMarks: ScaleMark[]): Promise<void> => {
    const ref = createRef<Gtk.Scale>();

    const { rerender } = await render(<ScaleWithMarks scaleRef={ref} marks={initialMarks} />);
    expectDefaultRange(ref.current);

    await rerender(<ScaleWithMarks scaleRef={ref} marks={updatedMarks} />);
    expectDefaultRange(ref.current);
};

describe("render - Scale marks (1)", () => {
    it("creates Scale widget without marks", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(<ScaleWithMarks scaleRef={ref} />);

        expectDefaultRange(ref.current);
    });

    it("creates Scale widget with marks", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(<ScaleWithMarks scaleRef={ref} marks={MIN_MID_MAX_MARKS} />);

        expectDefaultRange(ref.current);
    });

    it("sets mark position", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <ScaleWithMarks
                scaleRef={ref}
                marks={[
                    { value: 0, position: Gtk.PositionType.TOP, markup: "Top" },
                    { value: 100, position: Gtk.PositionType.BOTTOM, markup: "Bottom" },
                ]}
            />,
        );

        expectDefaultRange(ref.current);
    });
});

describe("render - Scale marks (2)", () => {
    it("sets marks without labels", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <ScaleWithMarks
                scaleRef={ref}
                marks={[
                    { value: 0, position: Gtk.PositionType.BOTTOM },
                    { value: 25, position: Gtk.PositionType.BOTTOM },
                    { value: 50, position: Gtk.PositionType.BOTTOM },
                    { value: 75, position: Gtk.PositionType.BOTTOM },
                    { value: 100, position: Gtk.PositionType.BOTTOM },
                ]}
            />,
        );

        expectDefaultRange(ref.current);
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
