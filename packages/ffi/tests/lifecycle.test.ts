import { installShutdownHandlers, stop, whenStopped } from "@gtkx/ffi";
import { describe, expect, it } from "vitest";

describe("installShutdownHandlers", () => {
    it("registers a SIGINT handler and detaches it on uninstall", () => {
        const before = process.listenerCount("SIGINT");

        const handle = installShutdownHandlers();
        expect(process.listenerCount("SIGINT")).toBe(before + 1);

        handle.uninstall();
        expect(process.listenerCount("SIGINT")).toBe(before);
    });
});

describe("stop and whenStopped", () => {
    it("resolves the whenStopped promise", async () => {
        const stopped = whenStopped();

        stop();

        await expect(stopped).resolves.toBeUndefined();
    });

    it("returns immediately on subsequent calls", () => {
        expect(() => stop()).not.toThrow();
    });
});
