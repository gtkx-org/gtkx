import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();
    return { ...actual, spawn: vi.fn() };
});

const { spawn: realSpawn } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
const { DEFAULT_HEADLESS_SIZE, startHeadlessDisplay } = await import("../src/headless-display.js");

const spawnMock = vi.mocked(spawn);

const spawnIdleChild = (): ChildProcess => realSpawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);

type Compositor = "sway" | "weston";

const compositorSocketName: { [K in Compositor]: string } = {
    sway: "wayland-1",
    weston: "wayland-0",
};

const wlrKeys = [
    "WLR_BACKENDS",
    "WLR_RENDERER",
    "WLR_RENDERER_ALLOW_SOFTWARE",
    "WLR_LIBINPUT_NO_DEVICES",
    "WLR_HEADLESS_OUTPUTS",
];

const trackedEnvKeys = [
    ...wlrKeys,
    "XDG_RUNTIME_DIR",
    "DBUS_SESSION_BUS_ADDRESS",
    "WAYLAND_DISPLAY",
    "GDK_BACKEND",
    "GDK_DISABLE",
    "GSK_RENDERER",
    "GTK_A11Y",
    "LIBGL_ALWAYS_SOFTWARE",
    "GSETTINGS_BACKEND",
];

describe("startHeadlessDisplay", () => {
    let children: ChildProcess[];
    let teardowns: Array<() => void>;
    let savedEnv: { [key: string]: string | undefined };

    const fulfillSockets = (compositor: Compositor): void => {
        const runtimeDir = process.env["XDG_RUNTIME_DIR"] ?? "";
        writeFileSync(join(runtimeDir, compositorSocketName[compositor]), "");
        writeFileSync(join(runtimeDir, "bus"), "");
    };

    beforeEach(() => {
        children = [];
        teardowns = [];
        savedEnv = {};
        for (const key of trackedEnvKeys) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
        spawnMock.mockReset();
        spawnMock.mockImplementation(() => {
            const child = spawnIdleChild();
            children.push(child);
            return child;
        });
    });

    afterEach(() => {
        for (const teardown of teardowns) teardown();
        for (const child of children) child.kill("SIGKILL");
        for (const key of trackedEnvKeys) {
            const value = savedEnv[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        spawnMock.mockReset();
    });

    it("selects the wayland-1 socket and sets the WLR_* env for sway", async () => {
        const pending = startHeadlessDisplay({ size: "800x600", compositor: "sway" });
        fulfillSockets("sway");
        teardowns.push(await pending);

        expect(process.env["WAYLAND_DISPLAY"]).toBe("wayland-1");
        expect(process.env["WLR_BACKENDS"]).toBe("headless");
        expect(process.env["WLR_RENDERER"]).toBe("pixman");
        expect(process.env["WLR_RENDERER_ALLOW_SOFTWARE"]).toBe("1");
        expect(process.env["WLR_LIBINPUT_NO_DEVICES"]).toBe("1");
        expect(process.env["WLR_HEADLESS_OUTPUTS"]).toBe("1");
    });

    it("selects the wayland-0 socket for weston without WLR_* env", async () => {
        const pending = startHeadlessDisplay({ size: "800x600", compositor: "weston" });
        fulfillSockets("weston");
        teardowns.push(await pending);

        expect(process.env["WAYLAND_DISPLAY"]).toBe("wayland-0");
        expect(process.env["WLR_BACKENDS"]).toBeUndefined();
    });

    it("passes the requested size through to the weston spawn arguments", async () => {
        const pending = startHeadlessDisplay({ size: "640x480", compositor: "weston" });
        fulfillSockets("weston");
        teardowns.push(await pending);

        const westonCall = spawnMock.mock.calls.find((call) => call[1]?.includes("weston"));
        const args = westonCall?.[1] ?? [];
        expect(args).toContain("--width=640");
        expect(args).toContain("--height=480");
    });

    it("renders the listen path, EXTERNAL auth, and policy lines in the bus config", async () => {
        const pending = startHeadlessDisplay({ size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });
        const runtimeDir = process.env["XDG_RUNTIME_DIR"] ?? "";
        fulfillSockets("weston");
        teardowns.push(await pending);

        const xml = readFileSync(join(runtimeDir, "session.conf"), "utf8");
        const socketPath = join(runtimeDir, "bus");
        expect(xml).toContain(`<listen>unix:path=${socketPath}</listen>`);
        expect(xml).toContain("<auth>EXTERNAL</auth>");
        expect(xml).toContain('<allow own="*"/>');
        expect(xml).toContain('<policy context="default">');
    });

    it("rejects when a spawned child exits before its socket appears", async () => {
        spawnMock.mockReset();
        spawnMock.mockImplementation(() => {
            const child = realSpawn(process.execPath, [
                "-e",
                "process.stderr.write('boom on startup\\n'); process.exit(1);",
            ]);
            children.push(child);
            return child;
        });

        await expect(startHeadlessDisplay({ size: "800x600", compositor: "weston" })).rejects.toThrow(
            /exited \(code 1, signal null\)[\s\S]*boom on startup/,
        );
    });
});
