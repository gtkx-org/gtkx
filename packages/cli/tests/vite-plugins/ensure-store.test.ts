import { describe, expect, it, vi } from "vitest";
import { ensureGenerated } from "../../src/codegen/run-codegen.js";
import { gtkxEnsureStore } from "../../src/vite-plugins/ensure-store.js";

type ConfigHook = () => Promise<void>;

const ensureGeneratedMock = vi.mocked(ensureGenerated);

const runConfig = async (): Promise<void> => {
    const plugin = gtkxEnsureStore();
    await (plugin.config as unknown as ConfigHook)();
};

vi.mock("../../src/codegen/run-codegen.js", () => ({
    ensureGenerated: vi.fn(() => Promise.resolve(false)),
}));

describe("gtkxEnsureStore", () => {
    it("generates the bindings before Vitest resolves a module", async () => {
        ensureGeneratedMock.mockClear();
        await runConfig();

        expect(ensureGeneratedMock).toHaveBeenCalledWith(process.cwd(), {
            shouldAnnounce: true,
            mode: "test",
        });
    });

    it("propagates a codegen failure instead of leaving the store missing", async () => {
        ensureGeneratedMock.mockClear();
        ensureGeneratedMock.mockRejectedValueOnce(new Error("invalid `applicationId`"));
        await expect(runConfig()).rejects.toThrow("invalid `applicationId`");
    });
});
