import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDevRunnerDeps } from "../../src/dev/runner-deps.js";

const hoisted = vi.hoisted(() => ({
    getDefault: vi.fn(
        () =>
            null as {
                applicationId: string | null;
                getIsRegistered?: () => boolean;
                getIsRemote?: () => boolean;
                on?: (signal: string, handler: () => void) => void;
            } | null,
    ),
    quitApplication: vi.fn(),
    installGracefulShutdown: vi.fn(),
    startMcpClient: vi.fn(() => Promise.resolve()),
    stopMcpClient: vi.fn(),
    setTestingModuleLoader: vi.fn(),
    mergeTestingModule: vi.fn((publicApi: object, internals: object) => ({ ...publicApi, ...internals })),
    performRefresh: vi.fn(),
    isRefreshBoundary: vi.fn(() => false),
    createServer: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@gtkx/gi/gio", () => ({
    Application: { getDefault: hoisted.getDefault },
}));

vi.mock("@gtkx/runtime", () => ({
    quitApplication: hoisted.quitApplication,
}));

vi.mock("@gtkx/utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@gtkx/utils")>()),
    installGracefulShutdown: hoisted.installGracefulShutdown,
}));

vi.mock("vite", () => ({
    createServer: hoisted.createServer,
}));

vi.mock("../../src/mcp/index.js", () => ({
    startMcpClient: hoisted.startMcpClient,
    stopMcpClient: hoisted.stopMcpClient,
}));

vi.mock("../../src/mcp/testing-loader.js", () => ({
    mergeTestingModule: hoisted.mergeTestingModule,
    setTestingModuleLoader: hoisted.setTestingModuleLoader,
}));

vi.mock("../../src/refresh-runtime.js", () => ({
    isRefreshBoundary: hoisted.isRefreshBoundary,
    performRefresh: hoisted.performRefresh,
}));

beforeEach(() => {
    hoisted.getDefault.mockReset();
});

describe("defaultDevRunnerDeps (wiring)", () => {
    it("wires the production collaborators", () => {
        const deps = defaultDevRunnerDeps();
        expect(deps.createServer).toBe(hoisted.createServer);
        expect(deps.stopMcpClient).toBe(hoisted.stopMcpClient);
        expect(deps.performRefresh).toBe(hoisted.performRefresh);
        expect(deps.isRefreshBoundary).toBe(hoisted.isRefreshBoundary);
    });

    it("installs an app-graph testing-module loader before starting the MCP client", async () => {
        const deps = defaultDevRunnerDeps();
        const loadAppModule = vi.fn(() => Promise.resolve({}));
        await deps.startMcpClient("com.example.app", loadAppModule);
        expect(hoisted.setTestingModuleLoader).toHaveBeenCalledTimes(1);
        expect(hoisted.startMcpClient).toHaveBeenCalledWith("com.example.app");
        const installedLoader = hoisted.setTestingModuleLoader.mock.calls[0]?.[0] as () => Promise<unknown>;
        await installedLoader();
        expect(loadAppModule).toHaveBeenCalledWith("@gtkx/testing");
        expect(loadAppModule).toHaveBeenCalledWith("@gtkx/testing/internal");
    });

    it("connects the runner shutdown handler to the live application's shutdown signal", () => {
        const deps = defaultDevRunnerDeps();
        const on = vi.fn();
        hoisted.getDefault.mockReturnValueOnce({ applicationId: null, on });
        const onShutdown = vi.fn();
        deps.watchApplicationShutdown(onShutdown);
        expect(on).toHaveBeenCalledWith("shutdown", onShutdown);
    });

    it("does nothing when no application is registered", () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce(null);

        expect(() => {
            deps.watchApplicationShutdown(vi.fn());
        }).not.toThrow();
    });
});

describe("defaultDevRunnerDeps (getApplicationInstance)", () => {
    it("separates the process that owns the application ID from the one that only reaches it", () => {
        const deps = defaultDevRunnerDeps();

        hoisted.getDefault.mockReturnValueOnce({
            applicationId: "com.example.app",
            getIsRegistered: () => true,
            getIsRemote: () => true,
        });

        expect(deps.getApplicationInstance()).toBe("remote");

        hoisted.getDefault.mockReturnValueOnce({
            applicationId: "com.example.app",
            getIsRegistered: () => true,
            getIsRemote: () => false,
        });

        expect(deps.getApplicationInstance()).toBe("primary");
    });

    it("reports an unregistered instance when no application mounted or it never registered", () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce(null);
        expect(deps.getApplicationInstance()).toBe("unregistered");

        hoisted.getDefault.mockReturnValueOnce({
            applicationId: "com.example.app",
            getIsRegistered: () => false,
        });

        expect(deps.getApplicationInstance()).toBe("unregistered");
    });
});

describe("defaultDevRunnerDeps (plugins)", () => {
    it("assembles the plugin list in the documented order", () => {
        const deps = defaultDevRunnerDeps();
        const names = deps.plugins().map((p) => p.name);

        expect(names).toEqual([
            "gtkx:config",
            "gtkx:undeclared-library",
            "gtkx:settings",
            "gtkx:icons",
            "gtkx:resources",
            "gtkx:css",
            "gtkx:react-compiler",
            "gtkx:swc-refresh",
            "gtkx:refresh-runtime",
            "gtkx:react-dom-prebundle",
        ]);
    });
});

describe("defaultDevRunnerDeps (waitForApplicationId)", () => {
    it("resolves the registered GLib applicationId", async () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValue({ applicationId: "com.example.app" });
        await expect(deps.waitForApplicationId(1000, () => true)).resolves.toBe("com.example.app");
    });

    it("keeps polling and resolves once the application mounts after a delay", async () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce(null).mockReturnValue({ applicationId: "com.example.late" });
        await expect(deps.waitForApplicationId(1000, () => true)).resolves.toBe("com.example.late");
    });

    it("resolves null when no application mounts before the timeout", async () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValue(null);
        await expect(deps.waitForApplicationId(60, () => true)).resolves.toBeNull();
    });

    it("gives up as soon as the caller stops waiting", async () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValue(null);
        const startedAt = Date.now();
        await expect(deps.waitForApplicationId(60_000, () => false)).resolves.toBeNull();
        expect(Date.now() - startedAt).toBeLessThan(5000);
    });
});

describe("defaultDevRunnerDeps (error watching)", () => {
    it("routes uncaught exceptions and unhandled rejections to the same handler", () => {
        const deps = defaultDevRunnerDeps();
        const on = vi.spyOn(process, "on").mockReturnValue(process);
        const onUncaughtError = vi.fn();

        try {
            deps.watchUncaughtErrors(onUncaughtError);
            expect(on).toHaveBeenCalledWith("uncaughtException", onUncaughtError);
            expect(on).toHaveBeenCalledWith("unhandledRejection", onUncaughtError);
        } finally {
            on.mockRestore();
        }
    });
});

describe("defaultDevRunnerDeps (shutdown wiring)", () => {
    beforeEach(() => {
        hoisted.quitApplication.mockReset();
        hoisted.installGracefulShutdown.mockReset();
    });

    it("routes shutdown handlers through installGracefulShutdown", () => {
        const deps = defaultDevRunnerDeps();
        const onSignal = vi.fn();
        deps.installShutdownHandlers(onSignal);
        expect(hoisted.installGracefulShutdown).toHaveBeenCalledWith({ onSignal });
    });

    it("quits the live default application", () => {
        const deps = defaultDevRunnerDeps();
        const application = { applicationId: "com.example.app" };
        hoisted.getDefault.mockReturnValueOnce(application);
        deps.quitDefaultApplication();
        expect(hoisted.quitApplication).toHaveBeenCalledWith(application);
    });

    it("does nothing when no default application is registered", () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce(null);
        deps.quitDefaultApplication();
        expect(hoisted.quitApplication).not.toHaveBeenCalled();
    });
});

describe("defaultDevRunnerDeps (getConfiguredApplicationId)", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-runner-config-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("resolves the applicationId declared in gtkx.config.ts", async () => {
        writeFileSync(join(root, "gtkx.config.ts"), 'export default { applicationId: "com.example.app" };\n');
        const deps = defaultDevRunnerDeps();
        await expect(deps.getConfiguredApplicationId(root)).resolves.toBe("com.example.app");
    });

    it("rejects when no config file exists, naming the directory searched", async () => {
        const deps = defaultDevRunnerDeps();

        await expect(deps.getConfiguredApplicationId(root)).rejects.toThrow(
            `gtkx.config.ts: no configuration file found in ${root}`,
        );
    });
});

describe("defaultDevRunnerDeps (readFileRevision)", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "gtkx-runner-revision-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("resolves the current contents of the changed file", async () => {
        const file = join(root, "app.tsx");
        writeFileSync(file, "export const marker = 1;\n");
        const deps = defaultDevRunnerDeps();
        await expect(deps.readFileRevision(file)).resolves.toBe("export const marker = 1;\n");
    });

    it("rejects instead of reporting an unreadable file as unchanged", async () => {
        const deps = defaultDevRunnerDeps();
        await expect(deps.readFileRevision(join(root, "gone.tsx"))).rejects.toThrow(/ENOENT/);
    });
});

describe("defaultDevRunnerDeps (log and exit)", () => {
    it("forwards log messages through the output sink with the [gtkx] prefix", () => {
        const deps = defaultDevRunnerDeps();
        const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        try {
            deps.log("hello");
            expect(spy).toHaveBeenCalledWith("[gtkx] hello\n");
        } finally {
            spy.mockRestore();
        }
    });

    it("delegates exit to process.exit with the given code", () => {
        const deps = defaultDevRunnerDeps();
        const spy = vi.spyOn(process, "exit").mockImplementation(((): void => undefined) as never);

        try {
            deps.exit(7);
            expect(spy).toHaveBeenCalledWith(7);
        } finally {
            spy.mockRestore();
        }
    });
});
