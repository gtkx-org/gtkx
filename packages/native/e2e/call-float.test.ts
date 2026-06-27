import { describe, expect, it } from "vitest";
import {
    callArgs,
    createLabel,
    createProgressBar,
    createScale,
    FLOAT64,
    GOBJECT,
    GOBJECT_BORROWED,
    GTK_LIB,
    VOID,
} from "./helpers/utils.js";

describe("call - float types - 64-bit float basic", () => {
    it("passes and returns 64-bit float values", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_opacity",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: FLOAT64, value: 0.75 },
            ],
            VOID,
        );

        const result = callArgs(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

        expect(result).toBeCloseTo(0.75);
    });
});

describe("call - float types - 64-bit float range", () => {
    it("handles range widget values", () => {
        const scale = createScale(0, 0, 100, 1);

        callArgs(
            GTK_LIB,
            "gtk_range_set_value",
            [
                { type: GOBJECT_BORROWED, value: scale },
                { type: FLOAT64, value: 42.5 },
            ],
            VOID,
        );

        const result = callArgs(GTK_LIB, "gtk_range_get_value", [{ type: GOBJECT_BORROWED, value: scale }], FLOAT64);

        expect(result).toBeCloseTo(42.5);
    });

    it("handles progress bar fraction", () => {
        const progressBar = createProgressBar();

        callArgs(
            GTK_LIB,
            "gtk_progress_bar_set_fraction",
            [
                { type: GOBJECT_BORROWED, value: progressBar },
                { type: FLOAT64, value: 0.65 },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_progress_bar_get_fraction",
            [{ type: GOBJECT_BORROWED, value: progressBar }],
            FLOAT64,
        );

        expect(result).toBeCloseTo(0.65);
    });
});

describe("call - float types - 64-bit float adjustment", () => {
    it("handles adjustment values", () => {
        const adjustment = callArgs(
            GTK_LIB,
            "gtk_adjustment_new",
            [
                { type: FLOAT64, value: 50.0 },
                { type: FLOAT64, value: 0.0 },
                { type: FLOAT64, value: 100.0 },
                { type: FLOAT64, value: 1.0 },
                { type: FLOAT64, value: 10.0 },
                { type: FLOAT64, value: 0.0 },
            ],
            GOBJECT,
        );

        const value = callArgs(
            GTK_LIB,
            "gtk_adjustment_get_value",
            [{ type: GOBJECT_BORROWED, value: adjustment }],
            FLOAT64,
        );

        expect(value).toBeCloseTo(50.0);

        callArgs(
            GTK_LIB,
            "gtk_adjustment_set_value",
            [
                { type: GOBJECT_BORROWED, value: adjustment },
                { type: FLOAT64, value: 75.0 },
            ],
            VOID,
        );

        const newValue = callArgs(
            GTK_LIB,
            "gtk_adjustment_get_value",
            [{ type: GOBJECT_BORROWED, value: adjustment }],
            FLOAT64,
        );

        expect(newValue).toBeCloseTo(75.0);
    });
});

describe("call - float types - edge cases zero", () => {
    it("handles zero", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_opacity",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: FLOAT64, value: 0.0 },
            ],
            VOID,
        );

        const result = callArgs(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

        expect(result).toBe(0.0);
    });
});

describe("call - float types - edge cases precision", () => {
    it("preserves precision for 64-bit floats", () => {
        const scale = createScale(0, 0, 1000000, 0.0001);

        const preciseValue = 123456.789012;

        callArgs(
            GTK_LIB,
            "gtk_range_set_value",
            [
                { type: GOBJECT_BORROWED, value: scale },
                { type: FLOAT64, value: preciseValue },
            ],
            VOID,
        );

        const result = callArgs(GTK_LIB, "gtk_range_get_value", [{ type: GOBJECT_BORROWED, value: scale }], FLOAT64);

        expect(result).toBeCloseTo(preciseValue, 6);
    });
});

describe("call - float types - edge cases boundary", () => {
    it("handles boundary values for opacity (0 to 1)", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_opacity",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: FLOAT64, value: 0.0 },
            ],
            VOID,
        );

        expect(
            callArgs(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64),
        ).toBeCloseTo(0.0);

        callArgs(
            GTK_LIB,
            "gtk_widget_set_opacity",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: FLOAT64, value: 1.0 },
            ],
            VOID,
        );

        expect(
            callArgs(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64),
        ).toBeCloseTo(1.0);
    });
});

describe("call - float types - edge cases multi-param", () => {
    it("handles multiple float parameters in one call", () => {
        const adjustment = callArgs(
            GTK_LIB,
            "gtk_adjustment_new",
            [
                { type: FLOAT64, value: 25.5 },
                { type: FLOAT64, value: 0.0 },
                { type: FLOAT64, value: 100.0 },
                { type: FLOAT64, value: 0.5 },
                { type: FLOAT64, value: 5.0 },
                { type: FLOAT64, value: 0.0 },
            ],
            GOBJECT,
        );

        const value = callArgs(
            GTK_LIB,
            "gtk_adjustment_get_value",
            [{ type: GOBJECT_BORROWED, value: adjustment }],
            FLOAT64,
        );

        const lower = callArgs(
            GTK_LIB,
            "gtk_adjustment_get_lower",
            [{ type: GOBJECT_BORROWED, value: adjustment }],
            FLOAT64,
        );

        const upper = callArgs(
            GTK_LIB,
            "gtk_adjustment_get_upper",
            [{ type: GOBJECT_BORROWED, value: adjustment }],
            FLOAT64,
        );

        const stepIncrement = callArgs(
            GTK_LIB,
            "gtk_adjustment_get_step_increment",
            [{ type: GOBJECT_BORROWED, value: adjustment }],
            FLOAT64,
        );

        expect(value).toBeCloseTo(25.5);
        expect(lower).toBeCloseTo(0.0);
        expect(upper).toBeCloseTo(100.0);
        expect(stepIncrement).toBeCloseTo(0.5);
    });
});
