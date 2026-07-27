import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDevRunnerDeps } from "../../src/dev/runner-deps.js";

const hoisted = vi.hoisted(() => ({
    getDefault: vi.fn(
        () => null as { applicationId: string | null; on?: (signal: string, handler: () => void) => void } | null,
    ),
    quitApplication: vi.fn(),
    installGracefulShutdown: vi.fn(),
    startMcpClient: vi.fn(() => Promise.resolve()),
    stopMcpClient: vi.fn(),
    setTestingModuleLoader: vi.fn(),
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
        await expect(deps.waitForApplicationId(1000)).resolves.toBe("com.example.app");
    });

    it("keeps polling and resolves once the application mounts after a delay", async () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce(null).mockReturnValue({ applicationId: "com.example.late" });
        await expect(deps.waitForApplicationId(1000)).resolves.toBe("com.example.late");
    });

    it("resolves null when no application mounts before the timeout", async () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValue(null);
        await expect(deps.waitForApplicationId(60)).resolves.toBeNull();
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

    it("resolves undefined when no config file exists", async () => {
        const deps = defaultDevRunnerDeps();
        await expect(deps.getConfiguredApplicationId(root)).resolves.toBeUndefined();
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
