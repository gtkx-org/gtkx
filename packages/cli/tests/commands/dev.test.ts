import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureGeneratedIn, resolveConfigWatch } from "../../src/codegen/run-codegen.js";
import { resolveCodegenContext } from "../../src/codegen/store-resolver.js";
import { dev } from "../../src/commands/dev.js";
import { runDevSupervisor } from "../../src/dev/supervisor.js";
import { setupTempTree, type TempTree } from "../temp-tree.js";
import { failNextConfigLoad, preflightCall, watchSentinel } from "./project-mocks.js";

type DevRun = NonNullable<typeof dev.run>;
type DevContext = Parameters<DevRun>[0];
type RunDevOptions = { entry?: string; argv?: string[]; cwd?: string };

const ensureGeneratedInMock = vi.mocked(ensureGeneratedIn);
const resolveCodegenContextMock = vi.mocked(resolveCodegenContext);
const resolveConfigWatchMock = vi.mocked(resolveConfigWatch);
const runDevSupervisorMock = vi.mocked(runDevSupervisor);

const runDev = ({ entry, argv, cwd }: RunDevOptions = {}): Promise<unknown> => {
    const run = dev.run;

    if (!run) {
        throw new Error("dev command has no run handler");
    }

    const args = { entry, cwd } as DevContext["args"];

    if (argv !== undefined) {
        vi.spyOn(process, "argv", "get").mockReturnValue(["node", "gtkx", ...argv]);
    }

    return Promise.resolve(run({ rawArgs: [], args, cmd: dev }));
};

const seedEntry = (project: TempTree, name: string): string => {
    const path = join(project.child, name);
    writeFileSync(path, "");

    return path;
};

const supervisorOptions = (): Parameters<typeof runDevSupervisor>[0] | undefined => {
    const [options] = runDevSupervisorMock.mock.calls[0] ?? [];

    return options;
};

const setupMockReset = (): void => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
};

vi.mock("../../src/codegen/run-codegen.js", async () => {
    const mocks = await import("./project-mocks.js");

    return mocks.runCodegenMocks();
});

vi.mock("../../src/codegen/store-resolver.js", async () => {
    const mocks = await import("./project-mocks.js");

    return mocks.storeResolverMocks();
});

vi.mock("../../src/dev/supervisor.js", () => ({
    runDevSupervisor: vi.fn(() => Promise.resolve()),
}));

describe("dev command", () => {
    setupMockReset();
    const project = setupTempTree("gtkx-dev-", "src");

    const expectNothingStarted = async (message: string, options: RunDevOptions): Promise<void> => {
        await expect(runDev({ ...options, cwd: project.path })).rejects.toThrow(message);
        expect(ensureGeneratedInMock).not.toHaveBeenCalled();
        expect(resolveConfigWatchMock).not.toHaveBeenCalled();
        expect(runDevSupervisorMock).not.toHaveBeenCalled();
    };

    it("runs preflight codegen and hands off to the supervisor with the resolved entry", async () => {
        const entryPath = seedEntry(project, "main.tsx");
        await runDev({ entry: "src/main.tsx", cwd: project.path });
        expect(ensureGeneratedInMock).toHaveBeenCalledWith(...preflightCall(project.path, "development"));
        expect(resolveConfigWatchMock).toHaveBeenCalledExactlyOnceWith(project.path, "development");
        expect(runDevSupervisorMock).toHaveBeenCalledOnce();
        expect(supervisorOptions()?.entryPath).toBe(entryPath);
        expect(supervisorOptions()?.cwd).toBe(project.path);
        expect(supervisorOptions()?.watch).toBe(watchSentinel);
    });

    it("uses src/index.tsx as the default entry when no positional is supplied", async () => {
        const entryPath = seedEntry(project, "index.tsx");
        await runDev({ cwd: project.path });
        expect(supervisorOptions()?.entryPath).toBe(entryPath);
    });

    it("rejects without running codegen when no entry file exists", async () => {
        await expectNothingStarted(`No entry file found in ${project.path}`, {});
        expect(resolveCodegenContextMock).toHaveBeenCalledOnce();
    });

    it("rejects without running codegen when the supplied entry does not exist", async () => {
        const message = `No entry file at ${join(project.child, "mian.tsx")}.`;
        await expectNothingStarted(message, { entry: "src/mian.tsx" });
    });

    it("reports a missing configuration before looking for an entry", async () => {
        await expectNothingStarted(failNextConfigLoad(resolveCodegenContextMock, project.path), {});
    });
});

describe("dev command — arguments for the application", () => {
    setupMockReset();
    const project = setupTempTree("gtkx-dev-args-", "src");

    const runWithArgv = (argv: string[]): Promise<unknown> => {
        seedEntry(project, "main.tsx");

        return runDev({ entry: "src/main.tsx", argv, cwd: project.path });
    };

    it("forwards everything after the separator", async () => {
        await runWithArgv(["dev", "src/main.tsx", "--", "--count=7", "file.db"]);
        expect(supervisorOptions()?.args).toEqual(["--count=7", "file.db"]);
    });

    it("passes nothing when no separator is present", async () => {
        await runWithArgv(["dev", "src/main.tsx", "--cwd", "/proj"]);
        expect(supervisorOptions()?.args).toEqual([]);
    });

    it("passes nothing when the separator is last", async () => {
        await runWithArgv(["dev", "src/main.tsx", "--"]);
        expect(supervisorOptions()?.args).toEqual([]);
    });

    it("keeps a separator that belongs to the application", async () => {
        await runWithArgv(["dev", "--", "--count=7", "--", "rest"]);
        expect(supervisorOptions()?.args).toEqual(["--count=7", "--", "rest"]);
    });
});
