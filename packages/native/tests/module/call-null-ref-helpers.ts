import { expect } from "vitest";
import { createLabel, measureWidget } from "./utils.js";

/**
 * Creates a label, measures it with a single integer out-parameter in the
 * `minRef` slot, and asserts that the slot was populated with a number.
 *
 * Mirrors the minimal single-ref measurement path shared by the null-pointer
 * and ref-type call suites.
 */
export function expectSingleMinRefMeasurementPopulatesNumber(): void {
    const label = createLabel("Test");
    const minRef = { value: 0 };

    measureWidget({ widget: label, orientation: 0, forSize: -1, minRef });

    expect(typeof minRef.value).toBe("number");
}
