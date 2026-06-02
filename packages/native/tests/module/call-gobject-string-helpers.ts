import { expect } from "vitest";
import { boxAppend, createBox, createLabel, getRefCount, startMemoryMeasurement } from "./utils.js";

/**
 * The box, the appended label, and the label's reference count captured before
 * the append.
 */
export type AppendedLabelRefCount = {
    box: unknown;
    label: unknown;
    initialRefCount: number;
};

/**
 * Creates a box and a label, appends the label to the box, and asserts that the
 * append raised the label's reference count by exactly one. Returns the box,
 * the label, and the reference count captured before the append.
 */
export function appendLabelAndExpectRefIncrement(): AppendedLabelRefCount {
    const box = createBox();
    const label = createLabel("Test");
    const initialRefCount = getRefCount(label);

    boxAppend(box, label);

    expect(getRefCount(label)).toBe(initialRefCount + 1);

    return { box, label, initialRefCount };
}

/**
 * Creates one thousand labels inside a measured loop and asserts that the heap
 * growth stays below five megabytes.
 */
export function expectNoLeakCreatingLabels(): void {
    const mem = startMemoryMeasurement();

    for (let i = 0; i < 1000; i++) {
        createLabel(`Label ${i}`);
    }

    expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
}
