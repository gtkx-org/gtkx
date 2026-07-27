import { runCommand } from "citty";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCreate, scaffoldCommand } from "../src/command.js";
import { scaffold } from "../src/scaffolder.js";

const scaffoldMock = vi.mocked(scaffold);

vi.mock("../src/scaffolder.js", () => ({
    scaffold: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
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
});

describe("runCreate — flag mapping", () => {
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

    it("rejects an unknown package manager before scaffolding", async () => {
        await expect(runCreate({ "package-manager": "bun" })).rejects.toThrow(/Unknown package manager "bun"/);
        expect(scaffoldMock).not.toHaveBeenCalled();
    });
});

describe("scaffoldCommand", () => {
    it("exposes the create metadata and the shared scaffold arguments", () => {
        expect(scaffoldCommand.meta).toMatchObject({ name: "create" });
        expect(scaffoldCommand.args).toHaveProperty("application-id");
        expect(scaffoldCommand.args).toHaveProperty("typescript");
    });

    it("parses --no-typescript into typescript: false through citty", async () => {
        scaffoldMock.mockClear();
        await runCommand(scaffoldCommand, { rawArgs: ["my-app", "--no-typescript", "--no-interactive"] });
        expect(scaffoldMock).toHaveBeenCalledTimes(1);
        expect(scaffoldMock).toHaveBeenCalledWith(expect.objectContaining({ typescript: false }));
    });
});
