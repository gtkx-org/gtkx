import * as Gtk from "@gtkx/gi/gtk";
import { GtkScale } from "@gtkx/jsx/gtk";
import { type ScaleMark, useAdjustment } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const ScaleWithMarks = ({ marks, scaleRef }: { marks?: ScaleMark[]; scaleRef: RefObject<Gtk.Scale | null> }) => {
    const adjustment = useAdjustment({ value: 0, lower: 0, upper: 100 });
    return <GtkScale ref={scaleRef} adjustment={adjustment} marks={marks} />;
};

const expectDefaultRange = (scale: Gtk.Scale | null): void => {
    expect(scale).toBeInstanceOf(Gtk.Scale);
    const adjustment = scale?.getAdjustment();
    expect(adjustment?.getLower()).toBe(0);
    expect(adjustment?.getUpper()).toBe(100);
    expect(adjustment?.getValue()).toBe(0);
};

const MIN_MAX_MARKS = [
    { value: 0, label: "Min" },
    { value: 100, label: "Max" },
];

const MIN_MID_MAX_MARKS = [
    { value: 0, label: "Min" },
    { value: 50, label: "Mid" },
    { value: 100, label: "Max" },
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
                    { value: 0, position: Gtk.PositionType.TOP, label: "Top" },
                    { value: 100, position: Gtk.PositionType.BOTTOM, label: "Bottom" },
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
                marks={[{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }]}
            />,
        );

        expectDefaultRange(ref.current);
    });

    it("updates marks when props change", async () => {
        await expectMarksTransition(
            [
                { value: 0, label: "Start" },
                { value: 100, label: "End" },
            ],
            [
                { value: 0, label: "Begin" },
                { value: 100, label: "End" },
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
