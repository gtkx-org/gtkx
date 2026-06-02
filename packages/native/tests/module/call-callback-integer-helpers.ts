import { expect } from "vitest";
import { connectSignal, createButton } from "./utils.js";

/**
 * Creates a button, connects an empty callback to its `clicked` signal, and
 * asserts that the returned handler id is a positive number.
 */
export function expectClickedSignalHandlerId(): void {
    const button = createButton("Test");

    const handlerId = connectSignal(button, "clicked", () => {});

    expect(typeof handlerId).toBe("number");
    expect(handlerId).toBeGreaterThan(0);
}
