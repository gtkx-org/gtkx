import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    getDefault: vi.fn(() => null as { applicationId: string | null } | null),
    quitApplication: vi.fn(),
    installGracefulShutdown: vi.fn(),
    startMcpClient: vi.fn(async () => undefined),
    stopMcpClient: vi.fn(),
    setTestingModuleLoader: vi.fn(),
    performRefresh: vi.fn(),
    isReactRefreshBoundary: vi.fn(() => false),
    createServer: vi.fn(async () => ({}) as unknown),
}));

vi.mock("@gtkx/gi/gio", () => ({
    Application: { getDefault: hoisted.getDefault },
}));

vi.mock("@gtkx/ffi", () => ({
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
    isReactRefreshBoundary: hoisted.isReactRefreshBoundary,
    performRefresh: hoisted.performRefresh,
}));

import { defaultDevRunnerDeps } from "../../src/dev/runner-deps.js";

beforeEach(() => {
    hoisted.getDefault.mockReset();
});

describe("defaultDevRunnerDeps (wiring)", () => {
    it("wires the production collaborators", () => {
        const deps = defaultDevRunnerDeps();

        expect(deps.createServer).toBe(hoisted.createServer);
        expect(deps.stopMcpClient).toBe(hoisted.stopMcpClient);
        expect(deps.performRefresh).toBe(hoisted.performRefresh);
        expect(deps.isReactRefreshBoundary).toBe(hoisted.isReactRefreshBoundary);
    });

    it("installs an app-graph testing-module loader before starting the MCP client", async () => {
        const deps = defaultDevRunnerDeps();
        const loadAppModule = vi.fn(async () => ({}));

        await deps.startMcpClient("com.example.app", loadAppModule);

        expect(hoisted.setTestingModuleLoader).toHaveBeenCalledTimes(1);
        expect(hoisted.startMcpClient).toHaveBeenCalledWith("com.example.app");

        const installedLoader = hoisted.setTestingModuleLoader.mock.calls[0]?.[0] as () => Promise<unknown>;
        await installedLoader();
        expect(loadAppModule).toHaveBeenCalledWith("@gtkx/testing");
    });

    it("installs a lifecycle whose quit forwards the app-graph default quit to the runner callback", async () => {
        const deps = defaultDevRunnerDeps();
        const setApplicationLifecycle = vi.fn();
        const defaultApplicationLifecycle = { quit: vi.fn() };
        const loadAppModule = vi.fn(async () => ({ setApplicationLifecycle, defaultApplicationLifecycle }));
        const onQuit = vi.fn();

        await deps.installApplicationLifecycle(loadAppModule, onQuit);

        expect(loadAppModule).toHaveBeenCalledWith("@gtkx/react");
        expect(setApplicationLifecycle).toHaveBeenCalledTimes(1);
        const installed = setApplicationLifecycle.mock.calls[0]?.[0] as { quit: (application: unknown) => void };
        const app = { quit: vi.fn() };
        installed.quit(app);

        expect(onQuit).toHaveBeenCalledTimes(1);
        const runDefaultQuit = onQuit.mock.calls[0]?.[0] as () => void;
        runDefaultQuit();
        expect(defaultApplicationLifecycle.quit).toHaveBeenCalledWith(app);
    });
});

describe("defaultDevRunnerDeps (plugins)", () => {
    it("assembles the plugin list in the documented order", () => {
        const deps = defaultDevRunnerDeps();

        const names = deps.plugins().map((p) => p.name);
        expect(names).toEqual([
            "gtkx:config",
            "gtkx:gsettings",
            "gtkx:gresources",
            "gtkx:assets",
            "gtkx:react-compiler",
            "gtkx:swc-ssr-refresh",
            "gtkx:refresh",
            "gtkx:skip-react-dom-optimize",
        ]);
    });
});

describe("defaultDevRunnerDeps (getApplicationId)", () => {
    it("returns the registered GLib applicationId", () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce({ applicationId: "com.example.app" });

        expect(deps.getApplicationId()).toBe("com.example.app");
    });

    it("returns null when no Gio.Application is registered", () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce(null);

        expect(deps.getApplicationId()).toBeNull();
    });

    it("returns null when the default Application has no id", () => {
        const deps = defaultDevRunnerDeps();
        hoisted.getDefault.mockReturnValueOnce({ applicationId: null });

        expect(deps.getApplicationId()).toBeNull();
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
        const spy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        try {
            deps.exit(7);
            expect(spy).toHaveBeenCalledWith(7);
        } finally {
            spy.mockRestore();
        }
    });
});
