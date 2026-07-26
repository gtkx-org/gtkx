import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { main } from "../../src/dev/runner-main.js";

describe("main (argv parsing)", () => {
    let exitSpy: Mock<typeof process.exit>;
    let stderrSpy: Mock<typeof process.stderr.write>;
    let originalArgv: string[];

    beforeEach(() => {
        originalArgv = process.argv;
        exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
        stderrSpy.mockRestore();
    });

    it("prints an error and exits 1 when no entry argument is supplied", async () => {
        process.argv = ["node", "runner"];

        exitSpy.mockImplementationOnce(() => {
            throw new Error("__exit__");
        });

        await expect(main()).rejects.toThrow("__exit__");
        const written = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
        expect(written).toContain("[gtkx] error Missing entry argument");
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
