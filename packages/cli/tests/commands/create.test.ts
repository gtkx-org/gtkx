import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/create.js", () => ({
    createApp: vi.fn(async () => undefined),
}));

import { create } from "../../src/commands/create.js";
import { createApp } from "../../src/create.js";

const createAppMock = vi.mocked(createApp);

type CommandRun<Args extends Record<string, unknown>> = (ctx: { args: Args }) => Promise<unknown>;

type CreateArgs = {
    name?: string;
    "application-id"?: string;
    pm?: string;
    testing?: string;
    "claude-skills"?: boolean;
};

describe("create", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("delegates to createApp with normalized options", async () => {
        const run = create.run as unknown as CommandRun<CreateArgs>;

        await run({
            args: {
                name: "my-app",
                "application-id": "com.example.myapp",
                pm: "pnpm",
                testing: "vitest",
                "claude-skills": true,
            },
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
        const run = create.run as unknown as CommandRun<CreateArgs>;

        await run({ args: {} });

        expect(createAppMock).toHaveBeenCalledWith({
            name: undefined,
            applicationId: undefined,
            packageManager: undefined,
            testing: undefined,
            claudeSkills: undefined,
        });
    });
});
