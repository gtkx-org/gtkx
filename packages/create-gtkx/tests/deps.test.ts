import { describe, expect, it, vi } from "vitest";

vi.mock("nypm", () => ({
    addDependency: vi.fn(async () => undefined),
    detectPackageManager: vi.fn(async () => ({ name: "pnpm" })),
}));

vi.mock("tinyexec", () => ({
    x: vi.fn(async () => undefined),
}));

import { addDependency, detectPackageManager } from "nypm";
import { x } from "tinyexec";
import { defaultScaffolderDeps } from "../src/deps.js";

const addDependencyMock = vi.mocked(addDependency);
const detectMock = vi.mocked(detectPackageManager);
const xMock = vi.mocked(x);

describe("defaultScaffolderDeps.install", () => {
    it("forwards dependencies, cwd, packageManager, and dev flag to nypm.addDependency", async () => {
        const deps = defaultScaffolderDeps();

        await deps.install({
            cwd: "/abs/proj",
            packageManager: "pnpm",
            dependencies: ["react", "lodash"],
            dev: true,
        });

        expect(addDependencyMock).toHaveBeenCalledWith(["react", "lodash"], {
            cwd: "/abs/proj",
            packageManager: "pnpm",
            dev: true,
            silent: true,
        });
    });

    it("does nothing when the dependency list is empty", async () => {
        addDependencyMock.mockClear();
        const deps = defaultScaffolderDeps();

        await deps.install({ cwd: "/abs/proj", packageManager: "pnpm", dependencies: [], dev: false });

        expect(addDependencyMock).not.toHaveBeenCalled();
    });
});

describe("defaultScaffolderDeps.gitInit", () => {
    it("runs git init, add -A, and commit in the project directory via tinyexec", async () => {
        xMock.mockClear();
        const deps = defaultScaffolderDeps();

        await deps.gitInit("/abs/proj");

        expect(xMock).toHaveBeenCalledTimes(3);
        expect(xMock).toHaveBeenNthCalledWith(
            1,
            "git",
            ["init"],
            expect.objectContaining({ nodeOptions: { cwd: "/abs/proj" } }),
        );
        expect(xMock).toHaveBeenNthCalledWith(2, "git", ["add", "-A"], expect.anything());
        expect(xMock).toHaveBeenNthCalledWith(3, "git", ["commit", "-m", "Initial commit"], expect.anything());
    });
});

describe("defaultScaffolderDeps.gtkxVersion", () => {
    it("reads the create-gtkx package version used to pin scaffolded @gtkx/* dependencies", () => {
        expect(defaultScaffolderDeps().gtkxVersion).toMatch(/^\d+\.\d+\.\d+/);
    });
});

describe("defaultScaffolderDeps.detectPackageManager", () => {
    it("returns the detected name when it is one of the supported managers", async () => {
        detectMock.mockResolvedValueOnce({ name: "yarn" } as never);
        const deps = defaultScaffolderDeps();

        await expect(deps.detectPackageManager("/abs/proj")).resolves.toBe("yarn");
    });

    it("returns undefined for unsupported managers (bun, deno)", async () => {
        detectMock.mockResolvedValueOnce({ name: "bun" } as never);
        const deps = defaultScaffolderDeps();

        await expect(deps.detectPackageManager("/abs/proj")).resolves.toBeUndefined();
    });

    it("returns undefined when nothing is detected", async () => {
        detectMock.mockResolvedValueOnce(undefined as never);
        const deps = defaultScaffolderDeps();

        await expect(deps.detectPackageManager("/abs/proj")).resolves.toBeUndefined();
    });
});
