import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/builder.js", () => ({
    build: vi.fn(async () => undefined),
}));

vi.mock("../../src/codegen/run-codegen.js", () => ({
    preflightCodegen: vi.fn(async () => undefined),
    runCodegen: vi.fn(),
}));

import { runCommand } from "citty";
import { build as buildApp } from "../../src/builder.js";
import { preflightCodegen } from "../../src/codegen/run-codegen.js";
import { build } from "../../src/commands/build.js";

const buildMock = vi.mocked(buildApp);
const preflightMock = vi.mocked(preflightCodegen);

describe("build", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        stderrSpy.mockRestore();
    });

    it("runs codegen preflight and builds with the default entry", async () => {
        await runCommand(build, { rawArgs: [] });

        expect(preflightMock).toHaveBeenCalledOnce();
        expect(buildMock).toHaveBeenCalledOnce();
        const buildCall = buildMock.mock.calls[0];
        if (!buildCall) throw new Error("build was not invoked");
        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/index\.tsx$/);
        expect(buildArgs.assetBase).toBeUndefined();
    });

    it("forwards a custom entry and asset-base flag", async () => {
        await runCommand(build, { rawArgs: ["src/main.tsx", "--asset-base", "../share/myapp"] });

        const buildCall = buildMock.mock.calls[0];
        if (!buildCall) throw new Error("build was not invoked");
        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/main\.tsx$/);
        expect(buildArgs.assetBase).toBe("../share/myapp");
    });
});
