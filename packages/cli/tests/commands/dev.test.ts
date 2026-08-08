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

const runDev = (entry?: string, argv?: string[]): Promise<unknown> => {
    const run = dev.run;

    if (!run) {
        throw new Error("dev command has no run handler");
    }

    const args = { entry } as DevContext["args"];

    if (argv !== undefined) {
        vi.spyOn(process, "argv", "get").mockReturnValue(["node", "gtkx", ...argv]);
    }

    return Promise.resolve(run({ rawArgs: [], args, cmd: dev }));
};

const setupMockReset = (): void => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
};

vi.mock("../../src/codegen/run-codegen.js", () => ({
    ensureGenerated: vi.fn(() => Promise.resolve(false)),
    resolveConfigWatch: vi.fn(() => Promise.resolve(watchSentinel)),
}));

vi.mock("../../src/dev/supervisor.js", () => ({
    runDevSupervisor: vi.fn(() => Promise.resolve()),
}));

describe("dev command", () => {
    setupMockReset();

    it("runs preflight codegen and hands off to the supervisor with the resolved entry", async () => {
        await runDev("src/main.tsx");

        expect(ensureGeneratedMock).toHaveBeenCalledWith(expect.any(String), {
            shouldAnnounce: true,
            mode: "development",
        });

        expect(resolveConfigWatchMock).toHaveBeenCalledExactlyOnceWith(expect.any(String), "development");
        expect(runDevSupervisorMock).toHaveBeenCalledOnce();
        const [options] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(options?.entryPath).toMatch(/src\/main\.tsx$/);
        expect(typeof options?.cwd).toBe("string");
        expect(options?.watch).toBe(watchSentinel);
    });

    it("uses src/index.tsx as the default entry when no positional is supplied", async () => {
        await runDev();
        const [options] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(options?.entryPath).toMatch(/src\/index\.tsx$/);
    });
});

describe("dev command — arguments for the application", () => {
    setupMockReset();

    it("forwards everything after the separator", async () => {
        await runDev("src/main.tsx", ["dev", "src/main.tsx", "--", "--count=7", "file.db"]);
        const [options] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(options?.args).toEqual(["--count=7", "file.db"]);
    });

    it("passes nothing when no separator is present", async () => {
        await runDev("src/main.tsx", ["dev", "src/main.tsx", "--cwd", "/proj"]);
        const [options] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(options?.args).toEqual([]);
    });

    it("passes nothing when the separator is last", async () => {
        await runDev("src/main.tsx", ["dev", "src/main.tsx", "--"]);
        const [options] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(options?.args).toEqual([]);
    });

    it("keeps a separator that belongs to the application", async () => {
        await runDev("src/main.tsx", ["dev", "--", "--count=7", "--", "rest"]);
        const [options] = runDevSupervisorMock.mock.calls[0] ?? [];
        expect(options?.args).toEqual(["--count=7", "--", "rest"]);
    });
});
