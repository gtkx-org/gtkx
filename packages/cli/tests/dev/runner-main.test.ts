import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { main } from "../../src/dev/runner-main.js";
import { collectLogged } from "../stderr-text.js";

describe("main (entry resolution)", () => {
    let exitSpy: Mock<typeof process.exit>;
    let stderrSpy: Mock<typeof process.stderr.write>;
    let originalEntry: string | undefined;

    beforeEach(() => {
        originalEntry = process.env.GTKX_DEV_ENTRY;
        exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        process.env.GTKX_DEV_ENTRY = originalEntry;
        exitSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    it("prints an error and exits 1 when the entry environment variable is missing", async () => {
        delete process.env.GTKX_DEV_ENTRY;

        exitSpy.mockImplementationOnce(() => {
            throw new Error("__exit__");
        });

        await expect(main()).rejects.toThrow("__exit__");
        const written = collectLogged(stderrSpy);
        expect(written).toContain("[gtkx] error Missing GTKX_DEV_ENTRY");
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
