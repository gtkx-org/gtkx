import { expect } from "vitest";
import { createLabel, measureWidget } from "./utils.js";

export function expectSingleMinRefMeasurementPopulatesNumber(): void {
    const label = createLabel("Test");
    const minRef = { value: 0 };

    measureWidget({ widget: label, orientation: 0, forSize: -1, minRef });

    expect(typeof minRef.value).toBe("number");
}
