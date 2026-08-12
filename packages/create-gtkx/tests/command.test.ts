import { renderUsage, runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCreate, scaffoldCommand } from "../src/command.js";
import { OperationCanceledError, ScaffoldAbortedError } from "../src/errors.js";
import { scaffold } from "../src/scaffolder.js";

const clack = vi.hoisted(() => ({
    log: { error: vi.fn() },
}));

const scaffoldMock = vi.mocked(scaffold);
const SHORT_SPELLING_PATTERN = /(?<![\w-])-(?!-)[\w-]+/g;

const printedShortSpellings = async (): Promise<string[]> => {
    const usage = await renderUsage(scaffoldCommand);

    return usage.matchAll(SHORT_SPELLING_PATTERN).map((match) => match[0].slice(1)).toArray();
};

vi.mock("@clack/prompts", () => clack);

vi.mock("../src/scaffolder.js", () => ({
    scaffold: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
});

afterEach(() => {
    process.exitCode = 0;
});

describe("runCreate — delegation", () => {
    it("normalizes the raw arguments and delegates to scaffold", async () => {
        await runCreate({
            name: "my-app",
            "application-id": "com.example.myapp",
            "package-manager": "pnpm",
            vitest: true,
        });

        expect(scaffoldMock).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "my-app",
                applicationId: "com.example.myapp",
                packageManager: "pnpm",
                shouldIncludeTesting: true,
            }),
        );
    });

    it("passes undefined for unspecified flags", async () => {
        await runCreate({});

        expect(scaffoldMock).toHaveBeenCalledWith(
            expect.objectContaining({
                name: undefined,
                applicationId: undefined,
                packageManager: undefined,
                isTypescript: undefined,
                shouldIncludeTesting: undefined,
                shouldOverwrite: undefined,
            }),
        );
    });
});

describe("runCreate — flag mapping", () => {
    it("maps --no-typescript to isTypescript: false", async () => {
        await runCreate({ name: "my-app", typescript: false });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ isTypescript: false }));
    });

    it("forwards isTypescript: true when explicitly requested", async () => {
        await runCreate({ name: "my-app", typescript: true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ isTypescript: true }));
    });

    it("disables interactive mode when --no-interactive is set", async () => {
        await runCreate({ name: "my-app", "no-interactive": true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ isInteractive: false }));
    });

    it("disables interactive mode when --yes is set", async () => {
        await runCreate({ name: "my-app", yes: true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ isInteractive: false }));
    });

    it("forwards the overwrite flag", async () => {
        await runCreate({ name: "my-app", "no-interactive": true, overwrite: true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ shouldOverwrite: true }));
    });

    it("forwards the requested package manager for the scaffolder to validate", async () => {
        await runCreate({ "package-manager": "bun" });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ packageManager: "bun" }));
    });
});

describe("runCreate — failure reporting", () => {
    it("reports an unexpected failure as one line and exits non-zero", async () => {
        scaffoldMock.mockRejectedValueOnce(new Error("EACCES: permission denied, mkdir '/tmp/my-app'"));
        await expect(runCreate({ name: "my-app" })).resolves.toBeUndefined();
        expect(clack.log.error).toHaveBeenCalledWith("EACCES: permission denied, mkdir '/tmp/my-app'");
        expect(process.exitCode).toBe(1);
    });

    it("exits non-zero without repeating a message the scaffolder already reported", async () => {
        scaffoldMock.mockRejectedValueOnce(new ScaffoldAbortedError('Directory "my-app" is not empty'));
        await expect(runCreate({ name: "my-app" })).resolves.toBeUndefined();
        expect(clack.log.error).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
    });

    it("keeps a zero exit code when the user cancels a prompt", async () => {
        scaffoldMock.mockRejectedValueOnce(new OperationCanceledError());
        await expect(runCreate({ name: "my-app" })).resolves.toBeUndefined();
        expect(clack.log.error).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(0);
    });
});

describe("scaffoldCommand", () => {
    it("exposes the create metadata and the shared scaffold arguments", () => {
        expect(scaffoldCommand.meta).toMatchObject({ name: "create" });
        expect(scaffoldCommand.args).toHaveProperty("application-id");
        expect(scaffoldCommand.args).toHaveProperty("typescript");
    });

    it("parses --no-typescript into isTypescript: false through citty", async () => {
        scaffoldMock.mockClear();
        await runCommand(scaffoldCommand, { rawArgs: ["my-app", "--no-typescript", "--no-interactive"] });
        expect(scaffoldMock).toHaveBeenCalledTimes(1);
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ isTypescript: false }));
    });
});

describe("scaffoldCommand — documented spellings", () => {
    it.each(["-p", "--package-manager"])("selects the package manager through %s", async (spelling) => {
        await runCommand(scaffoldCommand, { rawArgs: ["my-app", spelling, "yarn", "--no-interactive"] });

        expect(scaffoldMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: "my-app", packageManager: "yarn" }),
        );
    });

    it.each(["-f", "--overwrite"])("overwrites the target directory through %s", async (spelling) => {
        await runCommand(scaffoldCommand, { rawArgs: ["my-app", spelling, "--no-interactive"] });

        expect(scaffoldMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: "my-app", shouldOverwrite: true }),
        );
    });

    it("prints only short spellings the parser accepts", async () => {
        const spellings = await printedShortSpellings();
        expect(spellings).toEqual(expect.arrayContaining(["f", "p", "y"]));
        expect(spellings.filter((spelling) => spelling.length > 1)).toEqual([]);
    });
});
