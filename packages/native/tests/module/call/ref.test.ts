import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createLabel,
    createRef,
    GOBJECT_BORROWED,
    GTK_LIB,
    getRefCount,
    INT32,
    NULL,
    startMemoryMeasurement,
    UNDEFINED,
} from "../utils.js";

describe("call - ref types", () => {
    describe("integer refs", () => {
        it("populates 32-bit signed integer ref", () => {
            const label = createLabel("Test Label Content");
            const minRef = createRef(0);
            const naturalRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: minRef },
                    { type: { type: "ref", innerType: INT32 }, value: naturalRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(typeof minRef.value).toBe("number");
            expect(typeof naturalRef.value).toBe("number");
            expect(minRef.value).toBeGreaterThanOrEqual(0);
            expect(naturalRef.value).toBeGreaterThanOrEqual(minRef.value);
        });

        it("handles multiple integer refs in same call", () => {
            const label = createLabel("A longer test label for measuring");
            const minWidthRef = createRef(0);
            const naturalWidthRef = createRef(0);
            const minBaselineRef = createRef(0);
            const naturalBaselineRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: minWidthRef },
                    { type: { type: "ref", innerType: INT32 }, value: naturalWidthRef },
                    { type: { type: "ref", innerType: INT32 }, value: minBaselineRef },
                    { type: { type: "ref", innerType: INT32 }, value: naturalBaselineRef },
                ],
                UNDEFINED,
            );

            expect(typeof minWidthRef.value).toBe("number");
            expect(typeof naturalWidthRef.value).toBe("number");
            expect(typeof minBaselineRef.value).toBe("number");
            expect(typeof naturalBaselineRef.value).toBe("number");
        });

        it("measures widget in different orientations", () => {
            const label = createLabel("Test");

            const horizontalMinRef = createRef(0);
            const horizontalNaturalRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: horizontalMinRef },
                    { type: { type: "ref", innerType: INT32 }, value: horizontalNaturalRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            const verticalMinRef = createRef(0);
            const verticalNaturalRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 1 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: verticalMinRef },
                    { type: { type: "ref", innerType: INT32 }, value: verticalNaturalRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(horizontalMinRef.value).toBeGreaterThanOrEqual(0);
            expect(verticalMinRef.value).toBeGreaterThanOrEqual(0);
        });

        it("measures with for_size constraint", () => {
            const label = createLabel("Size test");
            const minRef = createRef(0);
            const naturalRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 1 },
                    { type: INT32, value: 100 },
                    { type: { type: "ref", innerType: INT32 }, value: minRef },
                    { type: { type: "ref", innerType: INT32 }, value: naturalRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(typeof minRef.value).toBe("number");
            expect(typeof naturalRef.value).toBe("number");
        });
    });

    describe("null refs", () => {
        it("ignores null refs (optional out params)", () => {
            const label = createLabel("Test");
            const minRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: minRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(typeof minRef.value).toBe("number");
        });

        it("uses null to indicate unneeded output", () => {
            const label = createLabel("Test");
            const naturalRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: NULL, value: null },
                    { type: { type: "ref", innerType: INT32 }, value: naturalRef },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(typeof naturalRef.value).toBe("number");
        });

        it("handles all null refs", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );
        });
    });

    describe("memory leaks", () => {
        it("does not leak when using many refs in loop", () => {
            const label = createLabel("Test Label for Memory Leak Check");
            const labelRefCount = getRefCount(label);
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 500; i++) {
                const minRef = createRef(0);
                const naturalRef = createRef(0);

                call(
                    GTK_LIB,
                    "gtk_widget_measure",
                    [
                        { type: GOBJECT_BORROWED, value: label },
                        { type: INT32, value: 0 },
                        { type: INT32, value: -1 },
                        { type: { type: "ref", innerType: INT32 }, value: minRef },
                        { type: { type: "ref", innerType: INT32 }, value: naturalRef },
                        { type: NULL, value: null },
                        { type: NULL, value: null },
                    ],
                    UNDEFINED,
                );
            }

            expect(getRefCount(label)).toBe(labelRefCount);
            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });

        it("does not leak with mixed null and real refs", () => {
            const label = createLabel("Test");
            const labelRefCount = getRefCount(label);
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 500; i++) {
                const ref = createRef(0);

                call(
                    GTK_LIB,
                    "gtk_widget_measure",
                    [
                        { type: GOBJECT_BORROWED, value: label },
                        { type: INT32, value: i % 2 },
                        { type: INT32, value: -1 },
                        {
                            type: i % 2 === 0 ? { type: "ref", innerType: INT32 } : NULL,
                            value: i % 2 === 0 ? ref : null,
                        },
                        {
                            type: i % 2 === 1 ? { type: "ref", innerType: INT32 } : NULL,
                            value: i % 2 === 1 ? ref : null,
                        },
                        { type: NULL, value: null },
                        { type: NULL, value: null },
                    ],
                    UNDEFINED,
                );
            }

            expect(getRefCount(label)).toBe(labelRefCount);
            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });
    });

    describe("edge cases", () => {
        it("handles ref initial value overwriting", () => {
            const label = createLabel("Test");
            const ref = createRef(9999);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: ref },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(ref.value).not.toBe(9999);
        });

        it("handles partial out-param usage (some null)", () => {
            const label = createLabel("Test");
            const minRef = createRef(0);
            const baselineRef = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: minRef },
                    { type: NULL, value: null },
                    { type: { type: "ref", innerType: INT32 }, value: baselineRef },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(typeof minRef.value).toBe("number");
            expect(typeof baselineRef.value).toBe("number");
        });

        it("handles ref reuse across multiple calls", () => {
            const label1 = createLabel("Short");
            const label2 = createLabel("This is a much longer label text");
            const ref = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label1 },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: ref },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            const shortWidth = ref.value;

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label2 },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: ref },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            const longWidth = ref.value;

            expect(longWidth).toBeGreaterThan(shortWidth);
        });

        it("ref values are consistent across multiple reads", () => {
            const label = createLabel("Consistent Test");
            const ref1 = createRef(0);
            const ref2 = createRef(0);

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: ref1 },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_widget_measure",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: INT32, value: 0 },
                    { type: INT32, value: -1 },
                    { type: { type: "ref", innerType: INT32 }, value: ref2 },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                    { type: NULL, value: null },
                ],
                UNDEFINED,
            );

            expect(ref1.value).toBe(ref2.value);
        });
    });
});
