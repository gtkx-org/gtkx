import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureGenerated, resolveConfigWatch } from "../../src/codegen/run-codegen.js";
import { dev } from "../../src/commands/dev.js";
import { runDevSupervisor } from "../../src/dev/supervisor.js";

type DevRun = NonNullable<typeof dev.run>;
type DevContext = Parameters<DevRun>[0];

const watchSentinel = { paths: ["/proj/gtkx.config.ts"], regenerate: () => Promise.resolve() };
const ensureGeneratedMock = vi.mocked(ensureGenerated);
const resolveConfigWatchMock = vi.mocked(resolveConfigWatch);
const runDevSupervisorMock = vi.mocked(runDevSupervisor);

const runDev = (entry?: string): Promise<unknown> => {
    const run = dev.run;

    if (!run) {
        throw new Error("dev command has no run handler");
    }

    const args = { entry } as DevContext["args"];

    return Promise.resolve(run({ rawArgs: [], args, cmd: dev }));
};

vi.mock("../../src/codegen/run-codegen.js", () => ({
    ensureGenerated: vi.fn(() => Promise.resolve(false)),
    resolveConfigWatch: vi.fn(() => Promise.resolve(watchSentinel)),
}));

vi.mock("../../src/dev/supervisor.js", () => ({
    runDevSupervisor: vi.fn(() => Promise.resolve()),
}));

describe("dev command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("runs preflight codegen and hands off to the supervisor with the resolved entry", async () => {
        await runDev("src/main.tsx");

        expect(ensureGeneratedMock).toHaveBeenCalledWith(expect.any(String), {
            shouldAnnounce: true,
            mode: "development",
        });

        expect(resolveConfigWatchMock).toHaveBeenCalledExactlyOnceWith(expect.any(String), "development");
        expect(runDevSupervisorMock).toHaveBeenCalledOnce();
        const [entryPath, cwd, watch] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(entryPath).toMatch(/src\/main\.tsx$/);
        expect(typeof cwd).toBe("string");
        expect(watch).toBe(watchSentinel);
    });

    it("uses src/index.tsx as the default entry when no positional is supplied", async () => {
        await runDev();
        const [entryPath] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(entryPath).toMatch(/src\/index\.tsx$/);
    });
});
