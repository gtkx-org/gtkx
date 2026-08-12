import { runCommand } from "citty";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { build as buildApp } from "../../src/builder.js";
import { ensureGenerated } from "../../src/codegen/run-codegen.js";
import { build } from "../../src/commands/build.js";
import { collectLogged } from "../stderr-text.js";
import { setupTempProject } from "../temp-project.js";
import { setupLogState } from "./log-state.js";

const buildMock = vi.mocked(buildApp);
const ensureGeneratedMock = vi.mocked(ensureGenerated);

const firstBuildArgs = (): Parameters<typeof buildApp>[0] => {
    const buildCall = buildMock.mock.calls[0];

    if (!buildCall) {
        throw new Error("build was not invoked");
    }

    return buildCall[0];
};

vi.mock("../../src/builder.js", () => ({
    build: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../src/codegen/run-codegen.js", () => ({
    ensureGenerated: vi.fn(() => Promise.resolve(false)),
    runCodegen: vi.fn(),
}));

describe("build", () => {
    const state = setupLogState();
    const project = setupTempProject("gtkx-build-");

    const seedEntry = (): void => {
        writeFileSync(join(project.path, "src", "index.tsx"), "");
    };

    const expectFailureBeforeAnnouncing = async (message: string): Promise<void> => {
        await expect(runCommand(build, { rawArgs: ["--cwd", project.path] })).rejects.toThrow(message);
        expect(collectLogged(state.stderrSpy)).not.toContain("Building");
        expect(buildMock).not.toHaveBeenCalled();
    };

    it("runs codegen preflight and builds with the default entry", async () => {
        seedEntry();

        ensureGeneratedMock.mockImplementationOnce(() => {
            expect(collectLogged(state.stderrSpy)).not.toContain("Building");

            return Promise.resolve(false);
        });

        await runCommand(build, { rawArgs: ["--cwd", project.path] });
        expect(ensureGeneratedMock).toHaveBeenCalledWith(project.path, { shouldAnnounce: true, mode: "production" });
        expect(collectLogged(state.stderrSpy)).toContain("Building");
        expect(buildMock).toHaveBeenCalledOnce();
        expect(firstBuildArgs().entry).toBe(join(project.path, "src", "index.tsx"));
        expect(firstBuildArgs().assetBase).toBeUndefined();
    });

    it("forwards a custom entry and asset-base flag", async () => {
        const rawArgs = ["src/main.tsx", "--cwd", project.path, "--asset-base", "../share/myapp"];
        await runCommand(build, { rawArgs });
        expect(firstBuildArgs().entry).toBe(join(project.path, "src", "main.tsx"));
        expect(firstBuildArgs().assetBase).toBe("../share/myapp");
    });

    it("does not announce an entry when the project has no configuration", async () => {
        seedEntry();
        const message = `gtkx.config.ts: no configuration file found in ${project.path}`;
        ensureGeneratedMock.mockRejectedValueOnce(new Error(message));
        await expectFailureBeforeAnnouncing(message);
    });

    it("does not announce an entry when the project has no entry file", async () => {
        await expectFailureBeforeAnnouncing(`No entry file found in ${project.path}`);
    });
});
