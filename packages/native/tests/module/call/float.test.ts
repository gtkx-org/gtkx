import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createLabel,
    createProgressBar,
    createScale,
    FLOAT64,
    GOBJECT,
    GOBJECT_BORROWED,
    GTK_LIB,
    UNDEFINED,
} from "../utils.js";

describe("call - float types", () => {
    describe("32-bit float", () => {
        it("passes 32-bit float values (promoted to 64-bit for GTK)", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 0.5 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBeCloseTo(0.5, 2);
        });

        it("handles small fractional values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 0.1 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBeCloseTo(0.1, 1);
        });

        it("handles value of 1.0", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 1.0 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBeCloseTo(1.0, 2);
        });
    });

    describe("64-bit float (double)", () => {
        it("passes and returns 64-bit float values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 0.75 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBeCloseTo(0.75);
        });

        it("handles values with high precision", () => {
            const label = createLabel("Test");
            const preciseValue = 0.12;

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: preciseValue },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBeCloseTo(preciseValue, 1);
        });

        it("handles very small values (near zero)", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 0.05 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBeCloseTo(0.05, 1);
        });

        it("handles range widget values", () => {
            const scale = createScale(0, 0, 100, 1);

            call(
                GTK_LIB,
                "gtk_range_set_value",
                [
                    { type: GOBJECT_BORROWED, value: scale },
                    { type: FLOAT64, value: 42.5 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_range_get_value", [{ type: GOBJECT_BORROWED, value: scale }], FLOAT64);

            expect(result).toBeCloseTo(42.5);
        });

        it("handles progress bar fraction", () => {
            const progressBar = createProgressBar();

            call(
                GTK_LIB,
                "gtk_progress_bar_set_fraction",
                [
                    { type: GOBJECT_BORROWED, value: progressBar },
                    { type: FLOAT64, value: 0.65 },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_progress_bar_get_fraction",
                [{ type: GOBJECT_BORROWED, value: progressBar }],
                FLOAT64,
            );

            expect(result).toBeCloseTo(0.65);
        });

        it("handles adjustment values", () => {
            const adjustment = call(
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

            const value = call(
                GTK_LIB,
                "gtk_adjustment_get_value",
                [{ type: GOBJECT_BORROWED, value: adjustment }],
                FLOAT64,
            );

            expect(value).toBeCloseTo(50.0);

            call(
                GTK_LIB,
                "gtk_adjustment_set_value",
                [
                    { type: GOBJECT_BORROWED, value: adjustment },
                    { type: FLOAT64, value: 75.0 },
                ],
                UNDEFINED,
            );

            const newValue = call(
                GTK_LIB,
                "gtk_adjustment_get_value",
                [{ type: GOBJECT_BORROWED, value: adjustment }],
                FLOAT64,
            );

            expect(newValue).toBeCloseTo(75.0);
        });
    });

    describe("edge cases", () => {
        it("handles zero", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 0.0 },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64);

            expect(result).toBe(0.0);
        });

        it("preserves precision for 64-bit floats", () => {
            const scale = createScale(0, 0, 1000000, 0.0001);

            const preciseValue = 123456.789012;

            call(
                GTK_LIB,
                "gtk_range_set_value",
                [
                    { type: GOBJECT_BORROWED, value: scale },
                    { type: FLOAT64, value: preciseValue },
                ],
                UNDEFINED,
            );

            const result = call(GTK_LIB, "gtk_range_get_value", [{ type: GOBJECT_BORROWED, value: scale }], FLOAT64);

            expect(result).toBeCloseTo(preciseValue, 6);
        });

        it("handles boundary values for opacity (0 to 1)", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 0.0 },
                ],
                UNDEFINED,
            );

            expect(
                call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64),
            ).toBeCloseTo(0.0);

            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: FLOAT64, value: 1.0 },
                ],
                UNDEFINED,
            );

            expect(
                call(GTK_LIB, "gtk_widget_get_opacity", [{ type: GOBJECT_BORROWED, value: label }], FLOAT64),
            ).toBeCloseTo(1.0);
        });

        it("handles multiple float parameters in one call", () => {
            const adjustment = call(
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

            const value = call(
                GTK_LIB,
                "gtk_adjustment_get_value",
                [{ type: GOBJECT_BORROWED, value: adjustment }],
                FLOAT64,
            );

            const lower = call(
                GTK_LIB,
                "gtk_adjustment_get_lower",
                [{ type: GOBJECT_BORROWED, value: adjustment }],
                FLOAT64,
            );

            const upper = call(
                GTK_LIB,
                "gtk_adjustment_get_upper",
                [{ type: GOBJECT_BORROWED, value: adjustment }],
                FLOAT64,
            );

            const stepIncrement = call(
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
});
