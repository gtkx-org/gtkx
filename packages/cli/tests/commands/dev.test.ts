import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const watchSentinel = { paths: ["/proj/gtkx.config.ts"], regenerate: async () => undefined };

vi.mock("../../src/codegen/run-codegen.js", () => ({
    preflightCodegen: vi.fn(async () => undefined),
    resolveConfigWatch: vi.fn(async () => watchSentinel),
}));

vi.mock("../../src/dev/supervisor.js", () => ({
    runDevSupervisor: vi.fn(async () => undefined),
}));

import { preflightCodegen, resolveConfigWatch } from "../../src/codegen/run-codegen.js";
import { dev } from "../../src/commands/dev.js";
import { runDevSupervisor } from "../../src/dev/supervisor.js";

const preflightMock = vi.mocked(preflightCodegen);
const resolveConfigWatchMock = vi.mocked(resolveConfigWatch);
const runDevSupervisorMock = vi.mocked(runDevSupervisor);

type CommandRun<Args extends Record<string, unknown>> = (ctx: { args: Args }) => Promise<unknown>;

describe("dev command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("runs preflight codegen and hands off to the supervisor with the resolved entry", async () => {
        const run = dev.run as unknown as CommandRun<{ entry?: string }>;

        await run({ args: { entry: "src/main.tsx" } });

        expect(preflightMock).toHaveBeenCalledOnce();
        expect(resolveConfigWatchMock).toHaveBeenCalledOnce();
        expect(runDevSupervisorMock).toHaveBeenCalledOnce();
        const [entryPath, watch] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(entryPath).toMatch(/src\/main\.tsx$/);
        expect(watch).toBe(watchSentinel);
    });

    it("uses src/index.tsx as the default entry when no positional is supplied", async () => {
        const run = dev.run as unknown as CommandRun<{ entry?: string }>;

        await run({ args: {} });

        const [entryPath] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(entryPath).toMatch(/src\/index\.tsx$/);
    });
});
