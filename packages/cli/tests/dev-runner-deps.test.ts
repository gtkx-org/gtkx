import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@gtkx/ffi/gio", () => ({
    Application: { getDefault: hoisted.getDefault },
}));

vi.mock("vite", () => ({
    createServer: hoisted.createServer,
}));

vi.mock("../src/mcp/index.js", () => ({
    startMcpClient: hoisted.startMcpClient,
    stopMcpClient: hoisted.stopMcpClient,
}));

vi.mock("../src/refresh-runtime.js", () => ({
    isReactRefreshBoundary: hoisted.isReactRefreshBoundary,
    performRefresh: hoisted.performRefresh,
}));

import { defaultDevRunnerDeps } from "../src/dev-runner-deps.js";

let cwd: string;

const writeConfig = (contents: string): void => {
    writeFileSync(join(cwd, "gtkx.config.ts"), contents);
};

const setupCwd = (): void => {
    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-dev-runner-deps-"));
        hoisted.getDefault.mockReset();
    });
    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });
};

describe("defaultDevRunnerDeps (wiring)", () => {
    setupCwd();

    it("wires the production collaborators with the resolved applicationId", async () => {
        writeConfig(`export default { applicationId: "org.gtk.Demo4" };\n`);
        const deps = await defaultDevRunnerDeps(cwd);

        expect(deps.createServer).toBe(hoisted.createServer);
        expect(deps.whenStopped).toBe(hoisted.whenStopped);
        expect(deps.startMcpClient).toBe(hoisted.startMcpClient);
        expect(deps.stopMcpClient).toBe(hoisted.stopMcpClient);
        expect(deps.performRefresh).toBe(hoisted.performRefresh);
        expect(deps.isReactRefreshBoundary).toBe(hoisted.isReactRefreshBoundary);
    });

    it("assembles the plugin list in the documented order", async () => {
        writeConfig(`export default { applicationId: "org.gtk.Demo4" };\n`);
        const deps = await defaultDevRunnerDeps(cwd);

        const plugins = deps.plugins();
        const names = plugins.map((p) => p.name);
        expect(names).toEqual([
            "gtkx:gsettings",
            "gtkx:gresources",
            "gtkx:assets",
            "gtkx:swc-ssr-refresh",
            "gtkx:refresh",
            "gtkx:remove-react-dom-optimized",
        ]);
    });
});

describe("defaultDevRunnerDeps (define)", () => {
    setupCwd();

    it("exposes the applicationId via define()", async () => {
        writeConfig(`export default { applicationId: "org.gtk.Demo4" };\n`);
        const deps = await defaultDevRunnerDeps(cwd);

        expect(deps.define()).toEqual({
            "import.meta.env.GTKX_APP_ID": JSON.stringify("org.gtk.Demo4"),
        });
    });

    it("emits an empty define when no config file is present", async () => {
        const deps = await defaultDevRunnerDeps(cwd);

        expect(deps.define()).toEqual({
            "import.meta.env.GTKX_APP_ID": '""',
        });
    });
});

describe("defaultDevRunnerDeps (getApplicationId)", () => {
    setupCwd();

    it("returns the registered GLib applicationId", async () => {
        const deps = await defaultDevRunnerDeps(cwd);
        hoisted.getDefault.mockReturnValueOnce({ applicationId: "com.example.app" });

        expect(deps.getApplicationId()).toBe("com.example.app");
    });

    it("returns null when no Gio.Application is registered", async () => {
        const deps = await defaultDevRunnerDeps(cwd);
        hoisted.getDefault.mockReturnValueOnce(null);

        expect(deps.getApplicationId()).toBeNull();
    });

    it("returns null when the default Application has no id", async () => {
        const deps = await defaultDevRunnerDeps(cwd);
        hoisted.getDefault.mockReturnValueOnce({ applicationId: null });

        expect(deps.getApplicationId()).toBeNull();
    });
});

describe("defaultDevRunnerDeps (log and exit)", () => {
    setupCwd();

    it("forwards log messages through console.log with the [gtkx] prefix", async () => {
        const deps = await defaultDevRunnerDeps(cwd);
        const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        try {
            deps.log("hello");
            expect(spy).toHaveBeenCalledWith("[gtkx] hello");
        } finally {
            spy.mockRestore();
        }
    });

    it("delegates exit to process.exit with the given code", async () => {
        const deps = await defaultDevRunnerDeps(cwd);
        const spy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        try {
            deps.exit(7);
            expect(spy).toHaveBeenCalledWith(7);
        } finally {
            spy.mockRestore();
        }
    });
});
