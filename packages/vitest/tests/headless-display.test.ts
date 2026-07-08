import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();
    return { ...actual, spawn: vi.fn(), spawnSync: vi.fn() };
});

const { spawn: realSpawn } = await vi.importActual<typeof import("node:child_process")>("node:child_process");
const { DEFAULT_HEADLESS_SIZE, readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } = await import(
    "../src/headless-display.js"
);

const spawnMock = vi.mocked(spawn);
const spawnSyncMock = vi.mocked(spawnSync);

const westonHelp = (text: string): SpawnSyncReturns<string> => ({
    pid: 0,
    output: [null, text, ""],
    stdout: text,
    stderr: "",
    status: 0,
    signal: null,
});

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

const trackedEnvKeys = [...wlrKeys, "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "WAYLAND_DISPLAY"];

describe("startHeadlessDisplay", () => {
    let children: ChildProcess[];
    let teardowns: Array<() => void>;
    let savedEnv: { [key: string]: string | undefined };

    const fulfillSockets = (compositor: Compositor): void => {
        const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "";
        writeFileSync(join(runtimeDir, compositorSocketName[compositor]), "");
        writeFileSync(join(runtimeDir, "bus"), "");
    };

    const startFulfilled = async (options: {
        size: string;
        compositor: Compositor;
    }): Promise<{ teardown: () => void; runtimeDir: string }> => {
        const pending = startHeadlessDisplay(options);
        const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "";
        fulfillSockets(options.compositor);
        const teardown = await pending;
        teardowns.push(teardown);
        return { teardown, runtimeDir };
    };

    const expectStartupFailure = async (makeChild: () => ChildProcess, message: RegExp): Promise<void> => {
        spawnMock.mockReset();
        spawnMock.mockImplementation(() => {
            const child = makeChild();
            children.push(child);
            return child;
        });

        const pending = startHeadlessDisplay({ size: "800x600", compositor: "weston" });
        const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "";

        await expect(pending).rejects.toThrow(message);

        expect(existsSync(runtimeDir)).toBe(false);
        expect(process.env.XDG_RUNTIME_DIR).toBeUndefined();
    };

    beforeEach(() => {
        children = [];
        teardowns = [];
        savedEnv = {};
        for (const key of trackedEnvKeys) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
        spawnSyncMock.mockReset();
        spawnSyncMock.mockReturnValue(westonHelp("--fake-seat"));
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
        spawnSyncMock.mockReset();
    });

    it("selects the wayland-1 socket and sets the WLR_* env for sway", async () => {
        await startFulfilled({ size: "800x600", compositor: "sway" });

        expect(process.env.WAYLAND_DISPLAY).toBe("wayland-1");
        expect(process.env.WLR_BACKENDS).toBe("headless");
        expect(process.env.WLR_RENDERER).toBe("pixman");
        expect(process.env.WLR_RENDERER_ALLOW_SOFTWARE).toBe("1");
        expect(process.env.WLR_LIBINPUT_NO_DEVICES).toBe("1");
        expect(process.env.WLR_HEADLESS_OUTPUTS).toBe("1");
    });

    it("selects the wayland-0 socket for weston without WLR_* env", async () => {
        await startFulfilled({ size: "800x600", compositor: "weston" });

        expect(process.env.WAYLAND_DISPLAY).toBe("wayland-0");
        expect(process.env.WLR_BACKENDS).toBeUndefined();
    });

    it("passes the requested size through to the weston spawn arguments", async () => {
        await startFulfilled({ size: "640x480", compositor: "weston" });

        const westonCall = spawnMock.mock.calls.find((call) => call[1]?.includes("weston"));
        const args = westonCall?.[1] ?? [];
        expect(args).toContain("--width=640");
        expect(args).toContain("--height=480");
    });

    it("includes --fake-seat when weston advertises the flag", async () => {
        await startFulfilled({ size: "800x600", compositor: "weston" });

        const westonCall = spawnMock.mock.calls.find((call) => call[1]?.includes("weston"));
        expect(westonCall?.[1]).toContain("--fake-seat");
    });

    it("omits --fake-seat when weston lacks the flag", async () => {
        vi.resetModules();
        spawnSyncMock.mockReturnValue(westonHelp("usage: weston [OPTIONS]"));
        const fresh = await import("../src/headless-display.js");

        const pending = fresh.startHeadlessDisplay({ size: "800x600", compositor: "weston" });
        fulfillSockets("weston");
        teardowns.push(await pending);

        const westonCall = spawnMock.mock.calls.find((call) => call[1]?.includes("weston"));
        expect(westonCall?.[1]).not.toContain("--fake-seat");
    });

    it("writes the resolution and border rules into the sway config", async () => {
        const { runtimeDir } = await startFulfilled({ size: "800x600", compositor: "sway" });

        const conf = readFileSync(join(runtimeDir, "sway.conf"), "utf8");
        expect(conf).toContain("output HEADLESS-1 resolution 800x600");
        expect(conf).toContain("xwayland disable");
        expect(conf).toContain("default_border none");
    });

    it("renders the listen path, EXTERNAL auth, and policy lines in the bus config", async () => {
        const { runtimeDir } = await startFulfilled({ size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });

        const xml = readFileSync(join(runtimeDir, "session.conf"), "utf8");
        const socketPath = join(runtimeDir, "bus");
        expect(xml).toContain(`<listen>unix:path=${socketPath}</listen>`);
        expect(xml).toContain("<auth>EXTERNAL</auth>");
        expect(xml).toContain('<allow own="*"/>');
        expect(xml).toContain('<policy context="default">');
    });

    it("reaps the bus, the compositor, and the runtime dir on teardown", async () => {
        process.env.WAYLAND_DISPLAY = "prior-value";
        const { teardown, runtimeDir } = await startFulfilled({ size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });

        expect(process.env.WAYLAND_DISPLAY).toBe("wayland-0");
        expect(existsSync(runtimeDir)).toBe(true);

        teardown();

        expect(existsSync(runtimeDir)).toBe(false);
        expect(process.env.WAYLAND_DISPLAY).toBe("prior-value");
        expect(process.env.XDG_RUNTIME_DIR).toBeUndefined();

        const [busChild, compositorChild] = children;
        expect(busChild?.killed).toBe(true);
        expect(compositorChild?.killed).toBe(true);
    });

    it("reaps only once when the teardown runs repeatedly", async () => {
        const { teardown } = await startFulfilled({ size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });

        const busChild = children[0];
        if (busChild === undefined) throw new Error("expected a spawned bus child");
        const killSpy = vi.spyOn(busChild, "kill");

        teardown();
        teardown();

        expect(killSpy).toHaveBeenCalledTimes(1);
    });

    it("rejects and cleans up when a spawned child exits before its socket appears", async () => {
        await expectStartupFailure(
            () => realSpawn(process.execPath, ["-e", "process.stderr.write('boom on startup\\n'); process.exit(1);"]),
            /exited \(code 1, signal null\)[\s\S]*boom on startup/,
        );
    });

    it("rejects and cleans up when a child fails to spawn", async () => {
        await expectStartupFailure(() => realSpawn("gtkx-nonexistent-binary-xyz", []), /failed to spawn/);
    });
});

describe("resolveHeadlessOptions", () => {
    it("fills the size and compositor defaults when nothing is provided", () => {
        expect(resolveHeadlessOptions({})).toEqual({ size: "1024x768", compositor: "weston" });
    });

    it("keeps the provided size and compositor", () => {
        expect(resolveHeadlessOptions({ size: "640x480", compositor: "sway" })).toEqual({
            size: "640x480",
            compositor: "sway",
        });
    });
});

describe("readHeadlessOptions", () => {
    it("returns an empty object when no parameters are present", () => {
        expect(readHeadlessOptions(new URLSearchParams())).toEqual({});
    });

    it("reads the size and a recognized compositor from the query", () => {
        expect(readHeadlessOptions(new URLSearchParams("size=640x480&compositor=sway"))).toEqual({
            size: "640x480",
            compositor: "sway",
        });
    });

    it("ignores an unrecognized compositor", () => {
        expect(readHeadlessOptions(new URLSearchParams("compositor=mutter"))).toEqual({});
    });
});
