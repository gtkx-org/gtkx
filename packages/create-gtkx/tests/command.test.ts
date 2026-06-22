import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/create.js", () => ({
    createApp: vi.fn(async () => undefined),
}));

import { type CreateCommandArgs, createCommand, runCreate } from "../src/command.js";
import { createApp } from "../src/create.js";

const createAppMock = vi.mocked(createApp);

describe("runCreate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("normalizes the raw arguments and delegates to createApp", async () => {
        await runCreate({
            name: "my-app",
            "application-id": "com.example.myapp",
            pm: "pnpm",
            testing: "vitest",
        });

        expect(createAppMock).toHaveBeenCalledWith({
            name: "my-app",
            applicationId: "com.example.myapp",
            packageManager: "pnpm",
            testing: "vitest",
        });
    });

    it("passes undefined for unspecified flags", async () => {
        await runCreate({});

        expect(createAppMock).toHaveBeenCalledWith({
            name: undefined,
            applicationId: undefined,
            packageManager: undefined,
            testing: undefined,
        });
    });

    const expectRejection = async (overrides: CreateCommandArgs, message: RegExp): Promise<void> => {
        await expect(runCreate(overrides)).rejects.toThrow(message);
        expect(createAppMock).not.toHaveBeenCalled();
    };

    it("rejects an unknown package manager before scaffolding", async () => {
        await expectRejection({ pm: "bun" }, /Unknown package manager "bun"/);
    });

    it("rejects an unknown testing setup before scaffolding", async () => {
        await expectRejection({ testing: "jest" }, /Unknown testing setup "jest"/);
    });
});

describe("createCommand", () => {
    it("exposes the create metadata and the shared scaffold arguments", () => {
        expect(createCommand.meta).toMatchObject({ name: "create" });
        expect(createCommand.args).toHaveProperty("application-id");
    });
});
