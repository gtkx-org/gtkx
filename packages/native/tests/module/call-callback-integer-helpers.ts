import { expect } from "vitest";
import { connectSignal, createButton } from "./utils.js";

export function expectClickedSignalHandlerId(): void {
    const button = createButton("Test");

    const handlerId = connectSignal(button, "clicked", () => {});

    expect(typeof handlerId).toBe("number");
    expect(handlerId).toBeGreaterThan(0);
}
