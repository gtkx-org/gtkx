import { describe, expect, it } from "vitest";
import { events } from "../src/index.js";

describe("events", () => {
    it("is an EventEmitter", () => {
        expect(typeof events.on).toBe("function");
        expect(typeof events.emit).toBe("function");
        expect(typeof events.removeListener).toBe("function");
    });

    it("allows registering start event listeners", () => {
        const handler = () => {};
        events.on("start", handler);
        expect(events.listenerCount("start")).toBeGreaterThan(0);
        events.removeListener("start", handler);
    });

    it("allows registering stop event listeners", () => {
        const handler = () => {};
        events.on("stop", handler);
        expect(events.listenerCount("stop")).toBeGreaterThan(0);
        events.removeListener("stop", handler);
    });
});
