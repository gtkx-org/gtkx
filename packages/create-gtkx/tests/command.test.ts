import { runCommand } from "citty";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/scaffolder.js", () => ({
    scaffold: vi.fn(async () => undefined),
}));

import { type CreateCommandArgs, createCommand, runCreate } from "../src/command.js";
import { scaffold } from "../src/scaffolder.js";

const scaffoldMock = vi.mocked(scaffold);

describe("runCreate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
                includeTesting: true,
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
                typescript: undefined,
                includeTesting: undefined,
                overwrite: undefined,
            }),
        );
    });

    it("maps --no-typescript to typescript: false", async () => {
        await runCreate({ name: "my-app", typescript: false });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ typescript: false }));
    });

    it("forwards typescript: true when explicitly requested", async () => {
        await runCreate({ name: "my-app", typescript: true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ typescript: true }));
    });

    it("disables interactive mode when --no-interactive is set", async () => {
        await runCreate({ name: "my-app", "no-interactive": true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ interactive: false }));
    });

    it("disables interactive mode when --yes is set", async () => {
        await runCreate({ name: "my-app", yes: true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ interactive: false }));
    });

    it("forwards the overwrite flag", async () => {
        await runCreate({ name: "my-app", "no-interactive": true, overwrite: true });
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ overwrite: true }));
    });

    const expectRejection = async (overrides: CreateCommandArgs, message: RegExp): Promise<void> => {
        await expect(runCreate(overrides)).rejects.toThrow(message);
        expect(scaffoldMock).not.toHaveBeenCalled();
    };

    it("rejects an unknown package manager before scaffolding", async () => {
        await expectRejection({ "package-manager": "bun" }, /Unknown package manager "bun"/);
    });
});

describe("createCommand", () => {
    it("exposes the create metadata and the shared scaffold arguments", () => {
        expect(createCommand.meta).toMatchObject({ name: "create" });
        expect(createCommand.args).toHaveProperty("application-id");
        expect(createCommand.args).toHaveProperty("typescript");
    });

    it("parses --no-typescript into typescript: false through citty", async () => {
        scaffoldMock.mockClear();
        await runCommand(createCommand, { rawArgs: ["my-app", "--no-typescript", "--no-interactive"] });
        expect(scaffoldMock).toHaveBeenCalledTimes(1);
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ typescript: false }));
    });
});
