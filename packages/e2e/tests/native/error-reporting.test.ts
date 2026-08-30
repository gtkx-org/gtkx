import { describe, expect, it } from "vitest";
import { runErrorChannel } from "../helpers/native-error-channel.js";

describe("native failures reported to the app", () => {
    it("happy path", async () => {
        const { exitCode, observed } = await runErrorChannel("none", "observed");
        expect(observed).toBeUndefined();
        expect(exitCode).toBe(0);
    });

    it("edge cases", async () => {
        const results = await Promise.all([
            runErrorChannel("critical", "observed"),
            runErrorChannel("panic", "observed"),
        ]);

        for (const { exitCode, observed } of results) {
            expect(observed).toBeDefined();
            expect(exitCode).toBe(0);
        }
    });

    it("error paths", async () => {
        await expect(
            (async () => {
                const { exitCode } = await runErrorChannel("critical", "ignored");

                if (exitCode !== 0) {
                    throw new Error("Native process failed");
                }
            })(),
        ).rejects.toThrow();
    });
});
