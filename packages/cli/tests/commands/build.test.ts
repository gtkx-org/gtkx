import { runCommand } from "citty";
import { describe, expect, it, vi } from "vitest";
import { build as buildApp } from "../../src/builder.js";
import { ensureGenerated } from "../../src/codegen/run-codegen.js";
import { build } from "../../src/commands/build.js";
import { setupLogState } from "./log-state.js";

const buildMock = vi.mocked(buildApp);
const ensureGeneratedMock = vi.mocked(ensureGenerated);

vi.mock("../../src/builder.js", () => ({
    build: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/codegen/run-codegen.js", () => ({
    ensureGenerated: vi.fn(() => Promise.resolve(false)),
    runCodegen: vi.fn(),
}));

describe("build", () => {
    setupLogState();

    it("runs codegen preflight and builds with the default entry", async () => {
        await runCommand(build, { rawArgs: [] });
        expect(ensureGeneratedMock).toHaveBeenCalledWith(expect.any(String), { announce: true, mode: "production" });
        expect(buildMock).toHaveBeenCalledOnce();
        const buildCall = buildMock.mock.calls[0];

        if (!buildCall) {
            throw new Error("build was not invoked");
        }

        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/index\.tsx$/);
        expect(buildArgs.assetBase).toBeUndefined();
    });

    it("forwards a custom entry and asset-base flag", async () => {
        await runCommand(build, { rawArgs: ["src/main.tsx", "--asset-base", "../share/myapp"] });
        const buildCall = buildMock.mock.calls[0];

        if (!buildCall) {
            throw new Error("build was not invoked");
        }

        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/main\.tsx$/);
        expect(buildArgs.assetBase).toBe("../share/myapp");
    });
});
