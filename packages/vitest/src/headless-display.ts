import { resolveExecutable, spawnWithParentDeathSignal, spawnWithParentDeathSupervisor } from "@gtkx/utils";
import { type ChildProcess, spawnSync } from "node:child_process";
import { chmodSync, closeSync, existsSync, mkdtempSync, openSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startNotificationService } from "./notification-service.ts";
import { startVirtualSeat } from "./virtual-seat.ts";

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
    requiresVirtualSeat: boolean;
    start: (runtimeDir: string, width: string, height: string) => ChildProcess;
};

type SpawnedCompositor = {
    child: ChildProcess;
    socket: string;
    requiresVirtualSeat: boolean;
};

type ChildMonitor = {
    label: string;
    path: string;
    read: () => string;
    failure: () => string | undefined;
    subscribe: (notify: (failure: string) => void) => () => void;
    stop: () => void;
};

type WaitForSocketOptions = {
    monitor: ChildMonitor;
    guards?: ChildMonitor[];
    timeout?: number;
};

type DisplaySockets = {
    compositorMonitor: ChildMonitor;
    busMonitor: ChildMonitor;
};

type CapturedStderr = {
    chunks: string[];
    stop: () => void;
};

type SocketWatch = {
    options: WaitForSocketOptions;
    resolve: () => void;
    reject: (error: Error) => void;
};

const DEFAULT_HEADLESS_SIZE = "1024x768";
const DEFAULT_HEADLESS_COMPOSITOR: CompositorId = "sway";
const HEADLESS_SIZE_PATTERN = /^[1-9]\d*x[1-9]\d*$/;

const BUS_CONFIG_DOCTYPE =
    '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
    '"https://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">';

const hasWestonFakeSeat = createWestonFakeSeatProbe();

const compositorRegistry: Record<CompositorId, CompositorDescriptor> = {
    sway: {
        socket: "wayland-1",
        requiresVirtualSeat: true,
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

            return spawnWithParentDeathSupervisor("sway", ["-c", configPath], {
                stdio: ["ignore", "ignore", "pipe"],
                cleanupDirectory: runtimeDir,
            });
        },
    },
    weston: {
        socket: "wayland-0",
        requiresVirtualSeat: false,
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
                { stdio: ["ignore", "ignore", "pipe"], cleanupDirectories: [_runtimeDir] },
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

const resolveHeadlessOptions = (provided: Partial<HeadlessOptions>): HeadlessOptions => {
    const size = provided.size ?? DEFAULT_HEADLESS_SIZE;

    if (!HEADLESS_SIZE_PATTERN.test(size)) {
        throw new Error(`Invalid headless display size: ${size}`);
    }

    return {
        size,
        compositor: provided.compositor ?? DEFAULT_HEADLESS_COMPOSITOR,
    };
};

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
        requiresVirtualSeat: descriptor.requiresVirtualSeat,
    };
};

const noVirtualSeat = (): void => undefined;

const attachVirtualSeat = (compositor: SpawnedCompositor, socketPath: string): Promise<() => void> =>
    compositor.requiresVirtualSeat ? startVirtualSeat(socketPath) : Promise.resolve(noVirtualSeat);

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

const exitedMessage = (label: string, path: string, code: number | null, signal: NodeJS.Signals | null): string =>
    `${label} exited (code ${String(code)}, signal ${signal ?? "null"}) before ${path} appeared`;

const monitorChild = (child: ChildProcess, label: string, path: string): ChildMonitor => {
    const stderr = child.stderr;
    const subscribers: Set<(failure: string) => void> = new Set();
    let log = "";
    let failure: string | undefined;

    const onData = (chunk: string): void => {
        log += chunk;
    };

    stderr?.setEncoding("utf8");
    stderr?.on("data", onData);

    const record = (cause: string): void => {
        failure ??= cause;

        for (const notify of subscribers) {
            notify(cause);
        }
    };

    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
        record(`${exitedMessage(label, path, code, signal)}\n${log}`);
    });

    child.on("error", (cause: Error) => {
        record(`${label} failed to spawn before ${path} appeared: ${cause.message}\n${log}`);
    });

    return {
        label,
        path,
        read: () => log,
        failure: () => failure,
        subscribe: (notify) => {
            subscribers.add(notify);

            return (): void => {
                subscribers.delete(notify);
            };
        },
        stop: () => {
            stderr?.removeListener("data", onData);
            stderr?.resume();

            if (stderr instanceof Socket) {
                stderr.unref();
            }
        },
    };
};

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

const firstFailure = (monitors: ChildMonitor[]): string | undefined => {
    for (const monitor of monitors) {
        const failure = monitor.failure();

        if (failure !== undefined) {
            return failure;
        }
    }

    return undefined;
};

const watchForSocket = ({ options, resolve, reject }: SocketWatch): void => {
    const { monitor, guards = [], timeout = 15_000 } = options;
    const watched = [monitor, ...guards];
    const cleanups: (() => void)[] = [monitor.stop];

    const stop = (): void => {
        runCleanups(cleanups);
    };

    const fail = (message: string): void => {
        stop();

        for (const guard of guards) {
            guard.stop();
        }

        reject(new Error(message));
    };

    const alreadyFailed = firstFailure(watched);

    if (alreadyFailed !== undefined) {
        fail(alreadyFailed);

        return;
    }

    const poll = pollForPath(monitor.path, () => {
        stop();
        resolve();
    });

    const timer = setTimeout(() => {
        fail(`${monitor.label} did not become available within ${String(timeout)}ms\n${monitor.read()}`);
    }, timeout);

    cleanups.push(
        () => {
            clearInterval(poll);
            clearTimeout(timer);
        },
        ...watched.map((entry) => entry.subscribe(fail)),
    );
};

const waitForSocket = (options: WaitForSocketOptions): Promise<void> =>
    new Promise((resolve, reject) => {
        watchForSocket({ options, resolve, reject });
    });

const captureCompositorStderr = (child: ChildProcess, logPath: string): CapturedStderr => {
    const captured: string[] = [];
    const stderr = child.stderr;

    if (stderr === null) {
        return { chunks: captured, stop: noVirtualSeat };
    }

    stderr.setEncoding("utf8");
    const descriptor = openSync(logPath, "a");
    let isOpen = true;

    const onData = (chunk: string): void => {
        captured.push(chunk);

        try {
            writeSync(descriptor, chunk);
        } catch {
            return;
        }
    };

    stderr.on("data", onData);

    return {
        chunks: captured,
        stop: () => {
            stderr.removeListener("data", onData);

            if (isOpen) {
                isOpen = false;
                closeSync(descriptor);
            }
        },
    };
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

const waitForDisplaySockets = async ({ compositorMonitor, busMonitor }: DisplaySockets): Promise<void> => {
    await waitForSocket({ monitor: busMonitor, guards: [compositorMonitor] });
    await waitForSocket({ monitor: compositorMonitor });
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
        applyEnv(env, STATIC_HEADLESS_ENV);
        applyEnv(env, { XDG_RUNTIME_DIR: runtimeDir });
        const busConfigPath = join(runtimeDir, "session.conf");
        const busSocketPath = join(runtimeDir, "bus");
        writeBusConfig(busConfigPath, busSocketPath);

        const busChild = spawnWithParentDeathSignal("dbus-daemon", [`--config-file=${busConfigPath}`], {
            stdio: ["ignore", "ignore", "pipe"],
            cleanupDirectories: [runtimeDir],
        });

        busChild.unref();
        spawned.push(busChild);
        const busMonitor = monitorChild(busChild, "D-Bus session bus", busSocketPath);
        applyEnv(env, { DBUS_SESSION_BUS_ADDRESS: `unix:path=${busSocketPath}` });
        const compositor = startCompositor(runtimeDir, options, env);
        compositor.child.unref();
        spawned.push(compositor.child);
        const compositorSocketPath = join(runtimeDir, compositor.socket);
        const compositorMonitor = monitorChild(compositor.child, "Compositor", compositorSocketPath);
        applyEnv(env, { WAYLAND_DISPLAY: compositor.socket });
        await waitForDisplaySockets({ compositorMonitor, busMonitor });
        const stopVirtualSeat = await attachVirtualSeat(compositor, compositorSocketPath);
        const stopNotifications = await startNotificationService(`unix:path=${busSocketPath}`);
        const capturedStderr = captureCompositorStderr(compositor.child, join(runtimeDir, "compositor.stderr.log"));
        const stopExitWatch = watchCompositorExit(compositor.child, capturedStderr.chunks);

        return makeTeardown([
            stopExitWatch,
            capturedStderr.stop,
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
    STATIC_HEADLESS_ENV,
    resolveHeadlessOptions,
    readHeadlessOptions,
    startHeadlessDisplay,
    type CompositorId,
    type HeadlessOptions,
};
