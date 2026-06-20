import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/create.js", () => ({
    createApp: vi.fn(async () => undefined),
}));

import { create } from "../../src/commands/create.js";
import { createApp } from "../../src/create.js";

const createAppMock = vi.mocked(createApp);

type CreateArgs = {
    name?: string;
    "application-id"?: string;
    pm?: string;
    testing?: string;
    "claude-skills"?: boolean;
};

type CreateRun = NonNullable<typeof create.run>;
type CreateContext = Parameters<CreateRun>[0];

const runCreate = (overrides: CreateArgs): Promise<unknown> => {
    const handler = create.run;
    if (!handler) throw new Error("create command has no run handler");
    const args = { ...overrides } as CreateContext["args"];
    return Promise.resolve(handler({ rawArgs: [], args, cmd: create }));
};

describe("create", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("delegates to createApp with normalized options", async () => {
        await runCreate({
            name: "my-app",
            "application-id": "com.example.myapp",
            pm: "pnpm",
            testing: "vitest",
            "claude-skills": true,
        });

        expect(createAppMock).toHaveBeenCalledWith({
            name: "my-app",
            applicationId: "com.example.myapp",
            packageManager: "pnpm",
            testing: "vitest",
            claudeSkills: true,
        });
    });

    it("passes undefined for unspecified flags", async () => {
        await runCreate({});

        expect(createAppMock).toHaveBeenCalledWith({
            name: undefined,
            applicationId: undefined,
            packageManager: undefined,
            testing: undefined,
            claudeSkills: undefined,
        });
    });

    it("rejects an unknown package manager before scaffolding", async () => {
        await expect(runCreate({ pm: "bun" })).rejects.toThrow(/Unknown package manager "bun"/);
        expect(createAppMock).not.toHaveBeenCalled();
    });

    it("rejects an unknown testing setup before scaffolding", async () => {
        await expect(runCreate({ testing: "jest" })).rejects.toThrow(/Unknown testing setup "jest"/);
        expect(createAppMock).not.toHaveBeenCalled();
    });
});
