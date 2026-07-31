import { type ChildProcess, spawn, spawnSync, type StdioOptions } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startNotificationService } from "./notification-service.js";
import { resolveExecutable } from "./resolve-executable.js";
import { startVirtualSeat } from "./virtual-seat.js";

/**
 * Wayland compositors that can back a headless display.
 */
type CompositorId = "sway" | "weston";

/**
 * Settings for the per-worker headless Wayland display.
 */
type HeadlessOptions = {
    /** Output resolution as a "WIDTHxHEIGHT" string, for example "1024x768". */
    size: string;
    /** Wayland compositor used to back the headless display. */
    compositor: CompositorId;
};

type EnvSnapshot = Record<string, string | undefined>;

type CompositorDescriptor = {
    socket: string;
    env: Record<string, string>;
    needsVirtualSeat: boolean;
    start: (runtimeDir: string, width: string, height: string) => ChildProcess;
};

type SpawnedCompositor = {
    child: ChildProcess;
    socket: string;
    needsVirtualSeat: boolean;
};

type WaitForSocketOptions = {
    label: string;
    timeout?: number;
    child?: ChildProcess;
    signal?: AbortSignal;
};

type StderrCapture = {
    read: () => string;
    stop: () => void;
};

type ChildHandlers = {
    exit: (code: number | null, signal: NodeJS.Signals | null) => void;
    error: (cause: Error) => void;
};

type DisplaySockets = {
    compositor: SpawnedCompositor;
    compositorSocketPath: string;
    busChild: ChildProcess;
    busSocketPath: string;
};

type SocketWatch = {
    path: string;
    options: WaitForSocketOptions;
    resolve: () => void;
    reject: (error: Error) => void;
};

const DEFAULT_HEADLESS_SIZE = "1024x768";
const DEFAULT_HEADLESS_COMPOSITOR: CompositorId = "sway";

const BUS_CONFIG_DOCTYPE =
    '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
    '"https://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">';

const PARENT_DEATH_SCRIPT = 'trap \'kill -9 "$child" 2>/dev/null\' TERM; "$@" & child=$!; wait "$child"';
const hasWestonFakeSeat = createWestonFakeSeatProbe();

const compositorRegistry: Record<CompositorId, CompositorDescriptor> = {
    sway: {
        socket: "wayland-1",
        needsVirtualSeat: true,
        env: {
            WLR_BACKENDS: "headless",
            WLR_RENDERER: "pixman",
            WLR_RENDERER_ALLOW_SOFTWARE: "1",
            WLR_LIBINPUT_NO_DEVICES: "1",
            WLR_HEADLESS_OUTPUTS: "1",
        },
        start: (runtimeDir, width, height) => {
            const configPath = join(runtimeDir, "sway.conf");

            writeFileSync(
                configPath,
                [
                    "xwayland disable",
                    "default_border none",
                    "default_floating_border none",
                    `output HEADLESS-1 resolution ${width}x${height}`,
                    "output HEADLESS-1 bg #000000 solid_color",
                    'for_window [app_id=".*"] floating enable, border none',
                    'for_window [title=".*"] floating enable, border none',
                    "",
                ].join("\n"),
            );

            return spawnWithParentDeathSignal("sway", ["-c", configPath], ["ignore", "ignore", "pipe"]);
        },
    },
    weston: {
        socket: "wayland-0",
        needsVirtualSeat: false,
        env: {},
        start: (_runtimeDir, width, height) =>
            spawnWithParentDeathSignal(
                "weston",
                [
                    "--backend=headless",
                    "--renderer=pixman",
                    ...(hasWestonFakeSeat() ? ["--fake-seat"] : []),
                    `--width=${width}`,
                    `--height=${height}`,
                    "--socket=wayland-0",
                ],
                ["ignore", "ignore", "pipe"],
            ),
    },
};

const STATIC_HEADLESS_ENV = {
    GDK_BACKEND: "wayland",
    GDK_DISABLE: "vulkan",
    GDK_DEBUG: "no-vsync",
    GSK_RENDERER: "cairo",
    GTK_A11Y: "test",
    LIBGL_ALWAYS_SOFTWARE: "1",
    GST_GL_WINDOW: "none",
    GSETTINGS_BACKEND: "memory",
    ALSOFT_DRIVERS: "null",
    ALSOFT_LOGLEVEL: "0",
};

const resolveHeadlessOptions = (provided: Partial<HeadlessOptions>): HeadlessOptions => ({
    size: provided.size ?? DEFAULT_HEADLESS_SIZE,
    compositor: provided.compositor ?? DEFAULT_HEADLESS_COMPOSITOR,
});

const applyEnv = (snapshot: EnvSnapshot, values: Record<string, string>): void => {
    for (const [name, value] of Object.entries(values)) {
        if (!Object.hasOwn(snapshot, name)) {
            snapshot[name] = process.env[name];
        }

        process.env[name] = value;
    }
};

const restoreEnv = (snapshot: EnvSnapshot): void => {
    for (const [name, previous] of Object.entries(snapshot)) {
        if (previous === undefined) {
            Reflect.deleteProperty(process.env, name);
        } else {
            process.env[name] = previous;
        }
    }
};

const spawnWithParentDeathSignal = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
    const child = spawn(
        resolveExecutable("setpriv"),
        ["--pdeathsig", "SIGTERM", "sh", "-c", PARENT_DEATH_SCRIPT, "sh", command, ...args],
        { stdio },
    );

    child.unref();

    return child;
};

function createWestonFakeSeatProbe(): () => boolean {
    let isSupported: boolean | undefined;

    return () => {
        if (isSupported === undefined) {
            const help = spawnSync(resolveExecutable("weston"), ["--help"], { encoding: "utf8" });
            isSupported = `${help.stdout}${help.stderr}`.includes("--fake-seat");
        }

        return isSupported;
    };
}

const isCompositorId = (value: string): value is CompositorId => Object.hasOwn(compositorRegistry, value);

const readHeadlessOptions = (params: URLSearchParams): Partial<HeadlessOptions> => {
    const options: Partial<HeadlessOptions> = {};
    const size = params.get("size");

    if (size !== null) {
        options.size = size;
    }

    const compositor = params.get("compositor");

    if (compositor !== null && isCompositorId(compositor)) {
        options.compositor = compositor;
    }

    return options;
};

const startCompositor = (runtimeDir: string, options: HeadlessOptions, env: EnvSnapshot): SpawnedCompositor => {
    const descriptor = compositorRegistry[options.compositor];
    const [width = "", height = ""] = options.size.split("x", 2);
    applyEnv(env, descriptor.env);

    return {
        child: descriptor.start(runtimeDir, width, height),
        socket: descriptor.socket,
        needsVirtualSeat: descriptor.needsVirtualSeat,
    };
};

const noVirtualSeat = (): void => undefined;

const attachVirtualSeat = (compositor: SpawnedCompositor, socketPath: string): Promise<() => void> =>
    compositor.needsVirtualSeat ? startVirtualSeat(socketPath) : Promise.resolve(noVirtualSeat);

const writeBusConfig = (busConfigPath: string, busSocketPath: string): void => {
    writeFileSync(
        busConfigPath,
        [
            BUS_CONFIG_DOCTYPE,
            "<busconfig>",
            "  <type>session</type>",
            `  <listen>unix:path=${busSocketPath}</listen>`,
            "  <auth>EXTERNAL</auth>",
            '  <policy context="default">',
            '    <allow send_destination="*" eavesdrop="true"/>',
            '    <allow eavesdrop="true"/>',
            '    <allow own="*"/>',
            "  </policy>",
            "</busconfig>",
        ].join("\n"),
    );
};

const captureStderr = (child: ChildProcess | undefined): StderrCapture => {
    const stderr = child?.stderr ?? null;
    let log = "";
    stderr?.setEncoding("utf8");

    stderr?.on("data", (chunk: string) => {
        log += chunk;
    });

    return {
        read: () => log,
        stop: () => {
            stderr?.removeAllListeners("data");
            stderr?.resume();

            if (stderr instanceof Socket) {
                stderr.unref();
            }
        },
    };
};

const trackChild = (child: ChildProcess, handlers: ChildHandlers): (() => void) => {
    child.on("exit", handlers.exit);
    child.on("error", handlers.error);

    return () => {
        child.removeListener("exit", handlers.exit);
        child.removeListener("error", handlers.error);
    };
};

const exitedMessage = (label: string, path: string, code: number | null, signal: NodeJS.Signals | null): string =>
    `${label} exited (code ${String(code)}, signal ${signal ?? "null"}) before ${path} appeared`;

const runCleanups = (cleanups: (() => void)[]): void => {
    for (const cleanup of cleanups) {
        cleanup();
    }

    cleanups.length = 0;
};

const pollForPath = (path: string, onFound: () => void): NodeJS.Timeout =>
    setInterval(() => {
        if (existsSync(path)) {
            onFound();
        }
    }, 50);

const stderrSuffix = (child: ChildProcess | undefined, stderr: StderrCapture): string =>
    child ? `\n${stderr.read()}` : "";

const hasAlreadyAborted = (signal: AbortSignal | undefined, onAbort: () => void, cleanups: (() => void)[]): boolean => {
    if (signal === undefined) {
        return false;
    }

    if (signal.aborted) {
        return true;
    }

    signal.addEventListener("abort", onAbort);

    cleanups.push(() => {
        signal.removeEventListener("abort", onAbort);
    });

    return false;
};

const watchForSocket = ({ path, options, resolve, reject }: SocketWatch): void => {
    const { label, timeout = 15_000, child, signal } = options;
    const stderr = captureStderr(child);
    const cleanups: (() => void)[] = [stderr.stop];

    const stop = (): void => {
        runCleanups(cleanups);
    };

    const fail = (message: string): void => {
        stop();
        reject(new Error(message));
    };

    const onExit = (code: number | null, terminationSignal: NodeJS.Signals | null): void => {
        fail(`${exitedMessage(label, path, code, terminationSignal)}\n${stderr.read()}`);
    };

    const onError = (cause: Error): void => {
        fail(`${label} failed to spawn: ${cause.message}\n${stderr.read()}`);
    };

    const onAbort = (): void => {
        fail(`${label} startup aborted before ${path} appeared`);
    };

    const poll = pollForPath(path, () => {
        stop();
        resolve();
    });

    const timer = setTimeout(() => {
        fail(`${label} did not become available within ${String(timeout)}ms${stderrSuffix(child, stderr)}`);
    }, timeout);

    cleanups.push(() => {
        clearInterval(poll);
        clearTimeout(timer);
    });

    if (child) {
        cleanups.push(trackChild(child, { exit: onExit, error: onError }));
    }

    if (hasAlreadyAborted(signal, onAbort, cleanups)) {
        onAbort();
    }
};

const waitForSocket = (path: string, options: WaitForSocketOptions): Promise<void> =>
    new Promise((resolve, reject) => {
        watchForSocket({ path, options, resolve, reject });
    });

const captureCompositorStderr = (child: ChildProcess, logPath: string): string[] => {
    const captured: string[] = [];
    const stderr = child.stderr;

    if (stderr !== null) {
        stderr.setEncoding("utf8");
        const logStream = createWriteStream(logPath);
        logStream.on("error", (): void => undefined);

        stderr.on("data", (chunk: string) => {
            captured.push(chunk);
            logStream.write(chunk);
        });
    }

    return captured;
};

const compositorExitMessage = (
    code: number | null,
    signal: NodeJS.Signals | null,
    capturedStderr: string[],
): string =>
    `[gtkx] the headless compositor exited (code ${String(code)}, signal ${signal ?? "null"}); ` +
    `every Wayland client in this worker has been severed.\n${capturedStderr.join("")}`;

const watchCompositorExit = (child: ChildProcess, capturedStderr: string[]): (() => void) => {
    const report = (code: number | null, signal: NodeJS.Signals | null): void => {
        process.stderr.write(compositorExitMessage(code, signal, capturedStderr));
    };

    child.on("exit", report);

    return () => child.removeListener("exit", report);
};

const waitForDisplaySockets = async (sockets: DisplaySockets): Promise<void> => {
    const { compositor, compositorSocketPath, busChild, busSocketPath } = sockets;
    const abort = new AbortController();

    try {
        await Promise.all([
            waitForSocket(compositorSocketPath, {
                label: "Compositor",
                child: compositor.child,
                signal: abort.signal,
            }),
            waitForSocket(busSocketPath, { label: "D-Bus session bus", child: busChild, signal: abort.signal }),
        ]);
    } finally {
        abort.abort();
    }
};

const killSpawned = (children: ChildProcess[]): void => {
    for (const child of children) {
        child.kill("SIGTERM");
    }
};

const makeTeardown = (stops: (() => void)[]): (() => void) => {
    let isTorndown = false;

    return (): void => {
        if (isTorndown) {
            return;
        }

        isTorndown = true;
        runCleanups(stops);
    };
};

const startHeadlessDisplay = async (options: HeadlessOptions): Promise<() => void> => {
    const env: EnvSnapshot = {};
    const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));
    chmodSync(runtimeDir, 0o700);
    const spawned: ChildProcess[] = [];

    const removeRuntime = (): void => {
        restoreEnv(env);
        rmSync(runtimeDir, { recursive: true, force: true });
    };

    try {
        applyEnv(env, { XDG_RUNTIME_DIR: runtimeDir });
        const busConfigPath = join(runtimeDir, "session.conf");
        const busSocketPath = join(runtimeDir, "bus");
        writeBusConfig(busConfigPath, busSocketPath);

        const busChild = spawnWithParentDeathSignal(
            "dbus-daemon",
            [`--config-file=${busConfigPath}`],
            ["ignore", "ignore", "pipe"],
        );

        spawned.push(busChild);
        applyEnv(env, { DBUS_SESSION_BUS_ADDRESS: `unix:path=${busSocketPath}` });
        const compositor = startCompositor(runtimeDir, options, env);
        spawned.push(compositor.child);
        applyEnv(env, { WAYLAND_DISPLAY: compositor.socket });
        const compositorSocketPath = join(runtimeDir, compositor.socket);
        await waitForDisplaySockets({ compositor, compositorSocketPath, busChild, busSocketPath });
        const stopVirtualSeat = await attachVirtualSeat(compositor, compositorSocketPath);
        const stopNotifications = await startNotificationService(`unix:path=${busSocketPath}`);
        const capturedStderr = captureCompositorStderr(compositor.child, join(runtimeDir, "compositor.stderr.log"));
        const stopExitWatch = watchCompositorExit(compositor.child, capturedStderr);

        return makeTeardown([
            stopExitWatch,
            () => {
                killSpawned(spawned);
            },
            stopVirtualSeat,
            stopNotifications,
            removeRuntime,
        ]);
    } catch (error) {
        killSpawned(spawned);
        removeRuntime();
        throw error;
    }
};

export {
    DEFAULT_HEADLESS_SIZE,
    STATIC_HEADLESS_ENV,
    resolveHeadlessOptions,
    readHeadlessOptions,
    startHeadlessDisplay,
    type CompositorId,
    type HeadlessOptions,
};
