import { expect } from "vitest";
import type { Value } from "../../types.js";
import { boxAppend, createBox, createLabel, getRefCount, startMemoryMeasurement } from "./utils.js";

export type AppendedLabelRefCount = {
    box: Value;
    label: Value;
    initialRefCount: number;
};

export function appendLabelAndExpectRefIncrement(): AppendedLabelRefCount {
    const box = createBox();
    const label = createLabel("Test");
    const initialRefCount = getRefCount(label);

    boxAppend(box, label);

    expect(getRefCount(label)).toBe(initialRefCount + 1);

    return { box, label, initialRefCount };
}

export function expectNoLeakCreatingLabels(): void {
    const mem = startMemoryMeasurement();

    for (let i = 0; i < 1000; i++) {
        createLabel(`Label ${i}`);
    }

    expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
}
