import { describe, expect, it } from "vitest";
import { runSurfaceRelease } from "../helpers/surface-release.js";

describe("releasing the last reference to a GdkSurface", () => {
    it("happy path", async () => {
        const { exitCode } = await runSurfaceRelease("undestroyed");
        expect(exitCode).toBe(0);
    });

    it("edge cases", async () => {
        const predestroyed = await runSurfaceRelease("predestroyed");
        const held = await runSurfaceRelease("held");
        expect(predestroyed.exitCode).toBe(0);
        expect(held.exitCode).toBe(0);
    });
});
