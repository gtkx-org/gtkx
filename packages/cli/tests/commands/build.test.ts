import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/builder.js", () => ({
    build: vi.fn(async () => undefined),
}));

vi.mock("../../src/codegen/run-codegen.js", () => ({
    preflightCodegen: vi.fn(async () => undefined),
    runCodegen: vi.fn(),
}));

vi.mock("../../src/codegen/config-loader.js", () => {
    class GtkxConfigNotFoundError extends Error {
        constructor() {
            super("not found");
            this.name = "GtkxConfigNotFoundError";
        }
    }
    return {
        GtkxConfigNotFoundError,
        loadGtkxConfig: vi.fn(async () => {
            throw new GtkxConfigNotFoundError();
        }),
        loadApplicationId: vi.fn(async () => undefined),
    };
});

import { build } from "../../src/builder.js";
import { preflightCodegen } from "../../src/codegen/run-codegen.js";
import { buildCmd } from "../../src/commands/build.js";

const buildMock = vi.mocked(build);
const preflightMock = vi.mocked(preflightCodegen);

type CommandRun<Args extends Record<string, unknown>> = (ctx: { args: Args }) => Promise<unknown>;

describe("buildCmd", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it("runs codegen preflight and builds with the default entry", async () => {
        const run = buildCmd.run as unknown as CommandRun<{ entry?: string; "asset-base"?: string }>;

        await run({ args: {} });

        expect(preflightMock).toHaveBeenCalledOnce();
        expect(buildMock).toHaveBeenCalledOnce();
        const buildCall = buildMock.mock.calls[0];
        if (!buildCall) throw new Error("build was not invoked");
        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/index\.tsx$/);
        expect(buildArgs.assetBase).toBeUndefined();
    });

    it("forwards a custom entry and asset-base flag", async () => {
        const run = buildCmd.run as unknown as CommandRun<{ entry?: string; "asset-base"?: string }>;

        await run({ args: { entry: "src/main.tsx", "asset-base": "../share/myapp" } });

        const buildCall = buildMock.mock.calls[0];
        if (!buildCall) throw new Error("build was not invoked");
        const buildArgs = buildCall[0];
        expect(buildArgs.entry).toMatch(/src\/main\.tsx$/);
        expect(buildArgs.assetBase).toBe("../share/myapp");
    });
});
