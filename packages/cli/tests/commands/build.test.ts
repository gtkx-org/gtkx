import { runCommand } from "citty";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { build as buildApp } from "../../src/builder.js";
import { ensureGeneratedIn } from "../../src/codegen/run-codegen.js";
import { resolveCodegenContext } from "../../src/codegen/store-resolver.js";
import { build } from "../../src/commands/build.js";
import { collectLogged } from "../stderr-text.js";
import { setupTempTree } from "../temp-tree.js";
import { setupLogState } from "./log-state.js";
import { failNextConfigLoad, preflightCall } from "./project-mocks.js";

const buildMock = vi.mocked(buildApp);
const ensureGeneratedInMock = vi.mocked(ensureGeneratedIn);
const resolveCodegenContextMock = vi.mocked(resolveCodegenContext);

const firstBuildArgs = (): Parameters<typeof buildApp>[0] => {
    const buildCall = buildMock.mock.calls[0];

    if (!buildCall) {
        throw new Error("build was not invoked");
    }

    return buildCall[0];
};

vi.mock("../../src/builder.js", () => ({
    build: vi.fn(() => Promise.resolve("dist/bundle.mjs")),
}));

vi.mock("../../src/codegen/run-codegen.js", async () => {
    const mocks = await import("./project-mocks.js");

    return mocks.runCodegenMocks();
});

vi.mock("../../src/codegen/store-resolver.js", async () => {
    const mocks = await import("./project-mocks.js");

    return mocks.storeResolverMocks();
});

describe("build", () => {
    const state = setupLogState();
    const project = setupTempTree("gtkx-build-", "src");

    const seedEntry = (name: string): string => {
        const path = join(project.child, name);
        writeFileSync(path, "");

        return path;
    };

    const runBuild = (...rawArgs: string[]): Promise<unknown> =>
        runCommand(build, { rawArgs: [...rawArgs, "--cwd", project.path] });

    const expectFailureBeforeAnnouncing = async (message: string, ...rawArgs: string[]): Promise<void> => {
        await expect(runBuild(...rawArgs)).rejects.toThrow(message);
        expect(collectLogged(state.stderrSpy)).not.toContain("Building");
        expect(buildMock).not.toHaveBeenCalled();
        expect(ensureGeneratedInMock).not.toHaveBeenCalled();
    };

    it("runs codegen preflight and builds with the default entry", async () => {
        const entryPath = seedEntry("index.tsx");
        buildMock.mockResolvedValueOnce("dist/bundle.mjs");

        ensureGeneratedInMock.mockImplementationOnce(() => {
            expect(collectLogged(state.stderrSpy)).not.toContain("Building");

            return Promise.resolve(false);
        });

        await runBuild();
        expect(ensureGeneratedInMock).toHaveBeenCalledWith(...preflightCall(project.path, "production"));
        expect(collectLogged(state.stderrSpy)).toContain("Building");
        expect(collectLogged(state.stderrSpy)).toContain("Build complete: dist/bundle.mjs");
        expect(buildMock).toHaveBeenCalledOnce();
        expect(firstBuildArgs().entry).toBe(entryPath);
        expect(firstBuildArgs().assetBase).toBeUndefined();
    });

    it("forwards a custom entry and asset-base flag", async () => {
        const entryPath = seedEntry("main.tsx");
        await runBuild("src/main.tsx", "--asset-base", "../share/myapp");
        expect(firstBuildArgs().entry).toBe(entryPath);
        expect(firstBuildArgs().assetBase).toBe("../share/myapp");
    });

    it("reports a custom entry that does not exist instead of building it", async () => {
        const message = `No entry file at ${join(project.child, "mian.tsx")}.`;
        await expectFailureBeforeAnnouncing(message, "src/mian.tsx");
    });

    it("does not announce an entry when the project has no entry file", async () => {
        await expectFailureBeforeAnnouncing(`No entry file found in ${project.path}`);
    });

    it("reports a missing configuration before looking for an entry", async () => {
        await expectFailureBeforeAnnouncing(failNextConfigLoad(resolveCodegenContextMock, project.path));
    });
});
