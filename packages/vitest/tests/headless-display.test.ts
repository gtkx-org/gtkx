import { type ChildProcess, spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Compositor = "sway" | "weston";

type HeadlessFixture = {
    children: ChildProcess[];
    teardowns: (() => void)[];
    savedEnv: Record<string, string | undefined>;
};

type StartupAttempt = { attempt: Promise<() => void>; runtimeDir: string };

const stopNotificationsMock = vi.fn();
const stopVirtualSeatMock = vi.fn();
const startVirtualSeatMock = vi.fn(() => Promise.resolve(stopVirtualSeatMock));
const { spawn: realSpawn } = await vi.importActual<typeof import("node:child_process")>("node:child_process");

const { DEFAULT_HEADLESS_SIZE, readHeadlessOptions, resolveHeadlessOptions, startHeadlessDisplay } = await import(
    "../src/headless-display.js",
);

const spawnMock = vi.mocked(spawn);
const spawnSyncMock = vi.mocked(spawnSync);

const compositorSocketName: Record<Compositor, string> = {
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

const findWestonCall = () => spawnMock.mock.calls.find((call) => call[1].some((arg) => basename(arg) === "weston"));

const westonHelp = (text: string): SpawnSyncReturns<string> => ({
    pid: 0,
    output: [null, text, ""],
    stdout: text,
    stderr: "",
    status: 0,
    signal: null,
});

const spawnIdleChild = (): ChildProcess => realSpawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);

const spawnExitingChild = (): ChildProcess =>
    realSpawn(process.execPath, [
        "-e",
        String.raw`process.stderr.write('boom on startup\n'); process.exit(1);`,
    ]);

const spawnMissingBinary = (): ChildProcess => realSpawn("gtkx-nonexistent-binary-xyz", []);

const saveTrackedEnv = (): Record<string, string | undefined> => {
    const saved: Record<string, string | undefined> = {};

    for (const key of trackedEnvKeys) {
        saved[key] = process.env[key];
        Reflect.deleteProperty(process.env, key);
    }

    return saved;
};

const restoreTrackedEnv = (saved: Record<string, string | undefined>): void => {
    for (const key of trackedEnvKeys) {
        const value = saved[key];

        if (value === undefined) {
            Reflect.deleteProperty(process.env, key);
        } else {
            process.env[key] = value;
        }
    }
};

const runTeardowns = (teardowns: (() => void)[]): void => {
    for (const teardown of teardowns) {
        teardown();
    }
};

const killChildren = (children: ChildProcess[]): void => {
    for (const child of children) {
        child.kill("SIGKILL");
    }
};

const fulfillSockets = (compositor: Compositor): void => {
    const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "";
    writeFileSync(join(runtimeDir, compositorSocketName[compositor]), "");
    writeFileSync(join(runtimeDir, "bus"), "");
};

const expectSwayWlrEnv = (): void => {
    expect(process.env.WLR_BACKENDS).toBe("headless");
    expect(process.env.WLR_RENDERER).toBe("pixman");
    expect(process.env.WLR_RENDERER_ALLOW_SOFTWARE).toBe("1");
    expect(process.env.WLR_LIBINPUT_NO_DEVICES).toBe("1");
    expect(process.env.WLR_HEADLESS_OUTPUTS).toBe("1");
};

const trackSpawnedChild = (fixture: HeadlessFixture, makeChild: () => ChildProcess): ChildProcess => {
    const child = makeChild();
    fixture.children.push(child);

    return child;
};

const installHeadlessFixture = (): HeadlessFixture => {
    const fixture: HeadlessFixture = { children: [], teardowns: [], savedEnv: {} };

    beforeEach(() => {
        fixture.children = [];
        fixture.teardowns = [];
        fixture.savedEnv = saveTrackedEnv();
        stopNotificationsMock.mockReset();
        stopVirtualSeatMock.mockReset();
        startVirtualSeatMock.mockClear();
        spawnSyncMock.mockReset();
        spawnSyncMock.mockReturnValue(westonHelp("--fake-seat"));
        spawnMock.mockReset();
        spawnMock.mockImplementation(() => trackSpawnedChild(fixture, spawnIdleChild));
    });

    afterEach(() => {
        runTeardowns(fixture.teardowns);
        killChildren(fixture.children);
        restoreTrackedEnv(fixture.savedEnv);
        spawnMock.mockReset();
        spawnSyncMock.mockReset();
    });

    return fixture;
};

const startFulfilled = async (
    fixture: HeadlessFixture,
    options: { size: string; compositor: Compositor },
): Promise<{ teardown: () => void; runtimeDir: string }> => {
    const pending = startHeadlessDisplay(options);
    const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "";
    fulfillSockets(options.compositor);
    const teardown = await pending;
    fixture.teardowns.push(teardown);

    return { teardown, runtimeDir };
};

const killAndAwaitExit = async (child: ChildProcess | undefined): Promise<void> => {
    if (child === undefined) {
        return;
    }

    const exited: Promise<void> = new Promise((resolve) => {
        child.once("exit", () => {
            resolve();
        });
    });

    child.kill("SIGKILL");
    await exited;
};

const startWithFailingChild = (fixture: HeadlessFixture, makeChild: () => ChildProcess): StartupAttempt => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => trackSpawnedChild(fixture, makeChild));
    const attempt = startHeadlessDisplay({ size: "800x600", compositor: "weston" });

    return { attempt, runtimeDir: process.env.XDG_RUNTIME_DIR ?? "" };
};

vi.mock("node:child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();

    return { ...actual, spawn: vi.fn(), spawnSync: vi.fn() };
});

vi.mock("../src/notification-service.js", () => ({
    startNotificationService: vi.fn(() => Promise.resolve(stopNotificationsMock)),
}));

vi.mock("../src/virtual-seat.js", () => ({
    startVirtualSeat: startVirtualSeatMock,
}));

describe("startHeadlessDisplay — compositor selection and configuration", () => {
    const fixture = installHeadlessFixture();

    it("selects the wayland-1 socket and sets the WLR_* env for sway", async () => {
        await startFulfilled(fixture, { size: "800x600", compositor: "sway" });
        expect(process.env.WAYLAND_DISPLAY).toBe("wayland-1");
        expectSwayWlrEnv();
    });

    it("selects the wayland-0 socket for weston without WLR_* env", async () => {
        await startFulfilled(fixture, { size: "800x600", compositor: "weston" });
        expect(process.env.WAYLAND_DISPLAY).toBe("wayland-0");
        expect(process.env.WLR_BACKENDS).toBeUndefined();
    });

    it("passes the requested size through to the weston spawn arguments", async () => {
        await startFulfilled(fixture, { size: "640x480", compositor: "weston" });
        const args = findWestonCall()?.[1] ?? [];
        expect(args).toContain("--width=640");
        expect(args).toContain("--height=480");
    });

    it("includes --fake-seat when weston advertises the flag", async () => {
        await startFulfilled(fixture, { size: "800x600", compositor: "weston" });
        expect(findWestonCall()?.[1]).toContain("--fake-seat");
    });

    it("omits --fake-seat when weston lacks the flag", async () => {
        vi.resetModules();
        spawnSyncMock.mockReturnValue(westonHelp("usage: weston [OPTIONS]"));
        const fresh = await import("../src/headless-display.js");
        const pending = fresh.startHeadlessDisplay({ size: "800x600", compositor: "weston" });
        fulfillSockets("weston");
        fixture.teardowns.push(await pending);
        expect(findWestonCall()?.[1]).not.toContain("--fake-seat");
    });

    it("writes the resolution and border rules into the sway config", async () => {
        const { runtimeDir } = await startFulfilled(fixture, { size: "800x600", compositor: "sway" });
        const conf = readFileSync(join(runtimeDir, "sway.conf"), "utf8");
        expect(conf).toContain("output HEADLESS-1 resolution 800x600");
        expect(conf).toContain("xwayland disable");
        expect(conf).toContain("default_border none");
    });

    it("renders the listen path, EXTERNAL auth, and policy lines in the bus config", async () => {
        const { runtimeDir } = await startFulfilled(fixture, { size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });
        const xml = readFileSync(join(runtimeDir, "session.conf"), "utf8");
        const socketPath = join(runtimeDir, "bus");
        expect(xml).toContain(`<listen>unix:path=${socketPath}</listen>`);
        expect(xml).toContain("<auth>EXTERNAL</auth>");
        expect(xml).toContain('<allow own="*"/>');
        expect(xml).toContain('<policy context="default">');
    });
});

describe("startHeadlessDisplay — teardown and startup failures", () => {
    const fixture = installHeadlessFixture();

    it("restores env, removes the runtime dir, and kills the compositor and bus on teardown", async () => {
        process.env.WAYLAND_DISPLAY = "prior-value";

        const { teardown, runtimeDir } = await startFulfilled(fixture, {
            size: DEFAULT_HEADLESS_SIZE,
            compositor: "weston",
        });

        expect(process.env.WAYLAND_DISPLAY).toBe("wayland-0");
        expect(existsSync(runtimeDir)).toBe(true);
        teardown();
        expect(existsSync(runtimeDir)).toBe(false);
        expect(process.env.WAYLAND_DISPLAY).toBe("prior-value");
        expect(process.env.XDG_RUNTIME_DIR).toBeUndefined();
        const [busChild, compositorChild] = fixture.children;
        expect(busChild?.killed).toBe(true);
        expect(compositorChild?.killed).toBe(true);
    });

    it("runs teardown only once when invoked repeatedly", async () => {
        const { teardown } = await startFulfilled(fixture, { size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });
        teardown();
        process.env.WAYLAND_DISPLAY = "set-after-teardown";
        teardown();
        expect(process.env.WAYLAND_DISPLAY).toBe("set-after-teardown");
        expect(stopNotificationsMock).toHaveBeenCalledTimes(1);
    });

    it("rejects and cleans up when a spawned child exits before its socket appears", async () => {
        const { attempt, runtimeDir } = startWithFailingChild(fixture, spawnExitingChild);
        await expect(attempt).rejects.toThrow(/exited \(code 1, signal null\)[\s\S]*boom on startup/);
        expect(existsSync(runtimeDir)).toBe(false);
        expect(process.env.XDG_RUNTIME_DIR).toBeUndefined();
    });

    it("rejects and cleans up when a child fails to spawn", async () => {
        const { attempt, runtimeDir } = startWithFailingChild(fixture, spawnMissingBinary);
        await expect(attempt).rejects.toThrow(/failed to spawn/);
        expect(existsSync(runtimeDir)).toBe(false);
        expect(process.env.XDG_RUNTIME_DIR).toBeUndefined();
    });
});

describe("startHeadlessDisplay — virtual seat", () => {
    const fixture = installHeadlessFixture();

    it("attaches a virtual seat to the sway socket, which has no input devices of its own", async () => {
        const { runtimeDir } = await startFulfilled(fixture, { size: "800x600", compositor: "sway" });
        expect(startVirtualSeatMock).toHaveBeenCalledWith(join(runtimeDir, "wayland-1"));
    });

    it("leaves the seat to weston, which fakes one itself", async () => {
        await startFulfilled(fixture, { size: "800x600", compositor: "weston" });
        expect(startVirtualSeatMock).not.toHaveBeenCalled();
    });

    it("closes the virtual seat connection on teardown", async () => {
        const { teardown } = await startFulfilled(fixture, { size: DEFAULT_HEADLESS_SIZE, compositor: "sway" });
        expect(stopVirtualSeatMock).not.toHaveBeenCalled();
        teardown();
        expect(stopVirtualSeatMock).toHaveBeenCalledTimes(1);
    });
});

describe("startHeadlessDisplay — compositor exit reporting", () => {
    const fixture = installHeadlessFixture();

    it("reports a compositor that dies while the display is in use", async () => {
        await startFulfilled(fixture, { size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });
        const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const [, compositorChild] = fixture.children;

        try {
            await killAndAwaitExit(compositorChild);
            expect(spy).toHaveBeenCalledWith(expect.stringContaining("the headless compositor exited"));
        } finally {
            spy.mockRestore();
        }
    });

    it("stays quiet about the compositor exit that teardown itself leads to", async () => {
        const { teardown } = await startFulfilled(fixture, { size: DEFAULT_HEADLESS_SIZE, compositor: "weston" });
        teardown();
        const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const [, compositorChild] = fixture.children;

        try {
            await killAndAwaitExit(compositorChild);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});

describe("resolveHeadlessOptions", () => {
    it("fills the size and compositor defaults when nothing is provided", () => {
        expect(resolveHeadlessOptions({})).toEqual({ size: "1024x768", compositor: "sway" });
    });

    it("keeps the provided size and compositor", () => {
        expect(resolveHeadlessOptions({ size: "640x480", compositor: "weston" })).toEqual({
            size: "640x480",
            compositor: "weston",
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
