import type * as Gtk from "@gtkx/gi/gtk";
import { GtkScale } from "@gtkx/jsx/gtk";
import { type AdjustmentConfig, useAdjustment } from "@gtkx/react";
import { render, waitFor } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

const ScaleWithAdjustment = ({
    config,
    scaleRef,
    onValueChanged,
}: {
    config: AdjustmentConfig;
    scaleRef: RefObject<Gtk.Scale | null>;
    onValueChanged?: (value: number) => void;
}) => {
    const adjustment = useAdjustment(config);
    return (
        <GtkScale
            ref={scaleRef}
            adjustment={adjustment}
            onValueChanged={onValueChanged ? (scale) => onValueChanged(scale.getValue()) : undefined}
        />
    );
};

/**
 * Renders a `GtkScale` driven by `useAdjustment(config)` and asserts that the
 * value read from its `Gtk.Adjustment` equals the expected number.
 */
const expectScaleAdjustment = async (
    config: AdjustmentConfig,
    read: (adjustment: Gtk.Adjustment | null | undefined) => number | undefined,
    expected: number,
) => {
    const ref = createRef<Gtk.Scale>();
    await render(<ScaleWithAdjustment config={config} scaleRef={ref} />);
    expect(read(ref.current?.getAdjustment())).toBe(expected);
};

describe("render - useAdjustment (1)", () => {
    it("supplies an Adjustment to the Scale widget", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 100 }} scaleRef={ref} />);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.getAdjustment()).not.toBeNull();
    });

    it("sets initial value", async () => {
        await expectScaleAdjustment({ value: 75, lower: 0, upper: 100 }, (adjustment) => adjustment?.getValue(), 75);
    });

    it("sets lower bound", async () => {
        await expectScaleAdjustment({ value: 50, lower: 10, upper: 100 }, (adjustment) => adjustment?.getLower(), 10);
    });

    it("sets upper bound", async () => {
        await expectScaleAdjustment({ value: 50, lower: 0, upper: 200 }, (adjustment) => adjustment?.getUpper(), 200);
    });

    it("sets step increment", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, stepIncrement: 5 },
            (adjustment) => adjustment?.getStepIncrement(),
            5,
        );
    });
});

describe("render - useAdjustment (2)", () => {
    it("sets page increment", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, pageIncrement: 20 },
            (adjustment) => adjustment?.getPageIncrement(),
            20,
        );
    });

    it("sets page size", async () => {
        await expectScaleAdjustment(
            { value: 50, lower: 0, upper: 100, pageSize: 10 },
            (adjustment) => adjustment?.getPageSize(),
            10,
        );
    });

    it("uses default values when not specified", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(<ScaleWithAdjustment config={{}} scaleRef={ref} />);

        const adjustment = ref.current?.getAdjustment();
        expect(adjustment?.getValue()).toBe(0);
        expect(adjustment?.getLower()).toBe(0);
        expect(adjustment?.getUpper()).toBe(100);
        expect(adjustment?.getStepIncrement()).toBe(1);
        expect(adjustment?.getPageIncrement()).toBe(10);
        expect(adjustment?.getPageSize()).toBe(0);
    });
});

describe("render - useAdjustment (3)", () => {
    it("keeps a stable adjustment but follows config value and bounds", async () => {
        const ref = createRef<Gtk.Scale>();

        const { rerender } = await render(
            <ScaleWithAdjustment config={{ value: 25, lower: 0, upper: 100 }} scaleRef={ref} />,
        );
        const adjustment = ref.current?.getAdjustment();
        expect(adjustment?.getValue()).toBe(25);

        await rerender(<ScaleWithAdjustment config={{ value: 75, lower: 0, upper: 200 }} scaleRef={ref} />);
        expect(ref.current?.getAdjustment()).toBe(adjustment);
        expect(adjustment?.getValue()).toBe(75);
        expect(adjustment?.getUpper()).toBe(200);
    });

    it("reflects values driven through the returned adjustment", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(<ScaleWithAdjustment config={{ value: 50, lower: 0, upper: 100 }} scaleRef={ref} />);
        const adjustment = ref.current?.getAdjustment();
        adjustment?.setUpper(200);
        adjustment?.setValue(80);

        expect(adjustment?.getUpper()).toBe(200);
        expect(adjustment?.getValue()).toBe(80);
    });
});

describe("render - useAdjustment (4)", () => {
    it("fires onValueChanged when the value changes", async () => {
        const ref = createRef<Gtk.Scale>();
        const onValueChanged = vi.fn();

        await render(
            <ScaleWithAdjustment
                config={{ value: 50, lower: 0, upper: 100 }}
                scaleRef={ref}
                onValueChanged={onValueChanged}
            />,
        );

        ref.current?.getAdjustment()?.setValue(75);

        await waitFor(() => {
            expect(onValueChanged).toHaveBeenCalledWith(75);
        });
    });

    it("stops firing onValueChanged when cleared", async () => {
        const ref = createRef<Gtk.Scale>();
        const onValueChanged = vi.fn();

        const { rerender } = await render(
            <ScaleWithAdjustment
                config={{ value: 50, lower: 0, upper: 100 }}
                scaleRef={ref}
                onValueChanged={onValueChanged}
            />,
        );
        ref.current?.getAdjustment()?.setValue(60);

        await waitFor(() => {
            expect(onValueChanged).toHaveBeenCalledWith(60);
        });
        const callCount = onValueChanged.mock.calls.length;

        await rerender(<ScaleWithAdjustment config={{ value: 60, lower: 0, upper: 100 }} scaleRef={ref} />);
        ref.current?.getAdjustment()?.setValue(70);

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(onValueChanged.mock.calls.length).toBe(callCount);
    });
});
