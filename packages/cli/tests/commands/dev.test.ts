import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/codegen/run-codegen.js", () => ({
    preflightCodegen: vi.fn(async () => undefined),
}));

vi.mock("../../src/dev/supervisor.js", () => ({
    runDevSupervisor: vi.fn(async () => undefined),
}));

import { preflightCodegen } from "../../src/codegen/run-codegen.js";
import { dev } from "../../src/commands/dev.js";
import { runDevSupervisor } from "../../src/dev/supervisor.js";

const preflightMock = vi.mocked(preflightCodegen);
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
        expect(runDevSupervisorMock).toHaveBeenCalledOnce();
        const [entryPath] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(entryPath).toMatch(/src\/main\.tsx$/);
    });

    it("uses src/index.tsx as the default entry when no positional is supplied", async () => {
        const run = dev.run as unknown as CommandRun<{ entry?: string }>;

        await run({ args: {} });

        const [entryPath] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(entryPath).toMatch(/src\/index\.tsx$/);
    });
});
