import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    getDefault: vi.fn(() => null as { applicationId: string | null } | null),
    startMcpClient: vi.fn(async () => undefined),
    stopMcpClient: vi.fn(),
    whenStopped: vi.fn(() => new Promise<void>(() => {})),
    performRefresh: vi.fn(),
    isReactRefreshBoundary: vi.fn(() => false),
    createServer: vi.fn(async () => ({}) as unknown),
}));

vi.mock("@gtkx/ffi", () => ({
    whenStopped: hoisted.whenStopped,
}));

vi.mock("@gtkx/gi/gio", () => ({
    Application: { getDefault: hoisted.getDefault },
}));

vi.mock("vite", () => ({
    createServer: hoisted.createServer,
}));

vi.mock("../../src/mcp/index.js", () => ({
    startMcpClient: hoisted.startMcpClient,
    stopMcpClient: hoisted.stopMcpClient,
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
        expect(deps.whenStopped).toBe(hoisted.whenStopped);
        expect(deps.startMcpClient).toBe(hoisted.startMcpClient);
        expect(deps.stopMcpClient).toBe(hoisted.stopMcpClient);
        expect(deps.performRefresh).toBe(hoisted.performRefresh);
        expect(deps.isReactRefreshBoundary).toBe(hoisted.isReactRefreshBoundary);
    });

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

describe("defaultDevRunnerDeps (log and exit)", () => {
    it("forwards log messages through console.log with the [gtkx] prefix", () => {
        const deps = defaultDevRunnerDeps();
        const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        try {
            deps.log("hello");
            expect(spy).toHaveBeenCalledWith("[gtkx] hello");
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
