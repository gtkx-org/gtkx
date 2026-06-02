import { describe, expect, it } from "vitest";
import { expectSingleMinRefMeasurementPopulatesNumber } from "../call-null-ref-helpers.js";
import { createLabel, getRefCount, measureWidget, measureWidgetAllNull, startMemoryMeasurement } from "../utils.js";

describe("call - ref types - integer refs basic", () => {
    it("populates 32-bit signed integer ref", () => {
        const label = createLabel("Test Label Content");
        const minRef = { value: 0 };
        const naturalRef = { value: 0 };

        measureWidget({ widget: label, orientation: 0, forSize: -1, minRef, naturalRef });

        expect(typeof minRef.value).toBe("number");
        expect(typeof naturalRef.value).toBe("number");
        expect(minRef.value).toBeGreaterThanOrEqual(0);
        expect(naturalRef.value).toBeGreaterThanOrEqual(minRef.value);
    });

    it("handles multiple integer refs in same call", () => {
        const label = createLabel("A longer test label for measuring");
        const minRef = { value: 0 };
        const naturalRef = { value: 0 };
        const minBaselineRef = { value: 0 };
        const naturalBaselineRef = { value: 0 };

        measureWidget({
            widget: label,
            orientation: 0,
            forSize: -1,
            minRef,
            naturalRef,
            minBaselineRef,
            naturalBaselineRef,
        });

        expect(typeof minRef.value).toBe("number");
        expect(typeof naturalRef.value).toBe("number");
        expect(typeof minBaselineRef.value).toBe("number");
        expect(typeof naturalBaselineRef.value).toBe("number");
    });
});

describe("call - ref types - integer refs orientations", () => {
    it("measures widget in different orientations", () => {
        const label = createLabel("Test");

        const horizontalMinRef = { value: 0 };
        const horizontalNaturalRef = { value: 0 };
        measureWidget({
            widget: label,
            orientation: 0,
            forSize: -1,
            minRef: horizontalMinRef,
            naturalRef: horizontalNaturalRef,
        });

        const verticalMinRef = { value: 0 };
        const verticalNaturalRef = { value: 0 };
        measureWidget({
            widget: label,
            orientation: 1,
            forSize: -1,
            minRef: verticalMinRef,
            naturalRef: verticalNaturalRef,
        });

        expect(horizontalMinRef.value).toBeGreaterThanOrEqual(0);
        expect(verticalMinRef.value).toBeGreaterThanOrEqual(0);
    });

    it("measures with for_size constraint", () => {
        const label = createLabel("Size test");
        const minRef = { value: 0 };
        const naturalRef = { value: 0 };

        measureWidget({ widget: label, orientation: 1, forSize: 100, minRef, naturalRef });

        expect(typeof minRef.value).toBe("number");
        expect(typeof naturalRef.value).toBe("number");
    });
});

describe("call - ref types - null refs", () => {
    it("ignores null refs (optional out params)", () => {
        expectSingleMinRefMeasurementPopulatesNumber();
    });

    it("uses null to indicate unneeded output", () => {
        const label = createLabel("Test");
        const naturalRef = { value: 0 };

        measureWidget({ widget: label, orientation: 0, forSize: -1, naturalRef });

        expect(typeof naturalRef.value).toBe("number");
    });

    it("handles all null refs", () => {
        const label = createLabel("Test");

        expect(measureWidgetAllNull(label)).toBeUndefined();
    });
});

describe("call - ref types - memory leaks loop", () => {
    it("does not leak when using many refs in loop", () => {
        const label = createLabel("Test Label for Memory Leak Check");
        const labelRefCount = getRefCount(label);
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 500; i++) {
            measureWidget({
                widget: label,
                orientation: 0,
                forSize: -1,
                minRef: { value: 0 },
                naturalRef: { value: 0 },
            });
        }

        expect(getRefCount(label)).toBe(labelRefCount);
        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - ref types - memory leaks mixed", () => {
    it("does not leak with mixed null and real refs", () => {
        const label = createLabel("Test");
        const labelRefCount = getRefCount(label);
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 500; i++) {
            const ref = { value: 0 };
            const useFirst = i % 2 === 0;
            measureWidget({
                widget: label,
                orientation: i % 2,
                forSize: -1,
                minRef: useFirst ? ref : null,
                naturalRef: useFirst ? null : ref,
            });
        }

        expect(getRefCount(label)).toBe(labelRefCount);
        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - ref types - edge cases overwriting", () => {
    it("handles ref initial value overwriting", () => {
        const label = createLabel("Test");
        const ref = { value: 9999 };

        measureWidget({ widget: label, orientation: 0, forSize: -1, minRef: ref });

        expect(ref.value).not.toBe(9999);
    });
});

describe("call - ref types - edge cases partial", () => {
    it("handles partial out-param usage (some null)", () => {
        const label = createLabel("Test");
        const minRef = { value: 0 };
        const baselineRef = { value: 0 };

        measureWidget({
            widget: label,
            orientation: 0,
            forSize: -1,
            minRef,
            minBaselineRef: baselineRef,
        });

        expect(typeof minRef.value).toBe("number");
        expect(typeof baselineRef.value).toBe("number");
    });
});

describe("call - ref types - edge cases reuse", () => {
    it("handles ref reuse across multiple calls", () => {
        const label1 = createLabel("Short");
        const label2 = createLabel("This is a much longer label text");
        const ref = { value: 0 };

        measureWidget({ widget: label1, orientation: 0, forSize: -1, minRef: ref });
        const shortWidth = ref.value;

        measureWidget({ widget: label2, orientation: 0, forSize: -1, minRef: ref });
        const longWidth = ref.value;

        expect(longWidth).toBeGreaterThan(shortWidth);
    });
});

describe("call - ref types - edge cases consistent reads", () => {
    it("ref values are consistent across multiple reads", () => {
        const label = createLabel("Consistent Test");
        const ref1 = { value: 0 };
        const ref2 = { value: 0 };

        measureWidget({ widget: label, orientation: 0, forSize: -1, minRef: ref1 });
        measureWidget({ widget: label, orientation: 0, forSize: -1, minRef: ref2 });

        expect(ref1.value).toBe(ref2.value);
    });
});
