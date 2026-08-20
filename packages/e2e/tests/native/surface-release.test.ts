import { describe, expect, it } from "vitest";
import { runSurfaceRelease } from "../helpers/surface-release.js";

describe("releasing the last reference to a GdkSurface", () => {
    it("destroys an undestroyed surface instead of warning", async () => {
        const { exitCode, output } = await runSurfaceRelease("undestroyed");
        expect(output).toContain("SETTLED");
        expect(output).not.toContain("Gdk-WARNING");
        expect(exitCode).toBe(0);
    });

    it("plainly releases a surface its window already destroyed", async () => {
        const { exitCode, output } = await runSurfaceRelease("predestroyed");
        expect(output).toContain("PREDESTROYED true");
        expect(output).toContain("SETTLED");
        expect(output).not.toContain("Gdk-WARNING");
        expect(exitCode).toBe(0);
    });

    it("leaves a surface intact while its window still holds it", async () => {
        const { exitCode, output } = await runSurfaceRelease("held");
        expect(output).toContain("HELD false");
        expect(output).toContain("SETTLED");
        expect(output).not.toContain("Gdk-WARNING");
        expect(exitCode).toBe(0);
    });
});
