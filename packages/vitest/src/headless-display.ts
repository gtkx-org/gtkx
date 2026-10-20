import {
    cleanupDirectoryIdentity,
    type ExternalTool,
    HEADLESS_DISPLAY_TOOLS,
    isProcessAlive,
    missingToolLines,
    readProcessIdentity,
    tryResolveExecutable,
} from "@gtkx/utils";
import { type ChildProcess, spawn } from "node:child_process";
import {
    chmodSync,
    closeSync,
    existsSync,
    mkdtempSync,
    openSync,
    renameSync,
    rmSync,
    writeFileSync,
    writeSync,
} from "node:fs";
import { connect, Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    createBusConfig,
    createHeadlessRuntimeMarker,
    createSwayConfig,
    HEADLESS_HELPER_ENV,
    HEADLESS_RUNTIME_MARKER,
} from "./headless-config.ts";
import { startNotificationService } from "./notification-service.ts";
import { type HeadlessRuntime, stopHeadlessRuntime } from "./reap-headless-displays.ts";
import { startVirtualSeat } from "./virtual-seat.ts";

/**
 * Settings for the per-worker headless Wayland display.
 */
type HeadlessOptions = {
    /** Output resolution as a "WIDTHxHEIGHT" string, for example "1024x768". */
    size: string;
};

type EnvSnapshot = Record<string, string | undefined>;

type HeadlessExecutables = Record<keyof typeof HEADLESS_DISPLAY_TOOLS, string>;

type ChildMonitor = {
    label: string;
    path: string;
    read: () => string;
    failure: () => string | undefined;
    isRunning: () => boolean;
    subscribe: (notify: (failure: string) => void) => () => void;
    stop: () => void;
};

type WaitForSocketsOptions = {
    monitors: ChildMonitor[];
    timeout?: number;
};

type DisplaySockets = {
    compositorMonitor: ChildMonitor;
    busMonitor: ChildMonitor;
};

type CapturedStderr = {
    chunks: string[];
    logPath: string;
    stop: () => void;
};

type SocketsWatch = {
    options: WaitForSocketsOptions;
    resolve: () => void;
    reject: (error: Error) => void;
};

const DEFAULT_HEADLESS_SIZE = "1024x768";
const HEADLESS_SIZE_PATTERN = /^[1-9]\d*x[1-9]\d*$/;
const COMPOSITOR_SOCKET = "wayland-1";

const COMPOSITOR_ENV = {
    WLR_BACKENDS: "headless",
    WLR_RENDERER: "pixman",
    WLR_RENDERER_ALLOW_SOFTWARE: "1",
    WLR_LIBINPUT_NO_DEVICES: "1",
    WLR_HEADLESS_OUTPUTS: "1",
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

    return { size };
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

const readHeadlessOptions = (params: URLSearchParams): Partial<HeadlessOptions> => {
    const options: Partial<HeadlessOptions> = {};
    const size = params.get("size");

    if (size !== null) {
        options.size = size;
    }

    return options;
};

const missingToolsMessage = (missing: ExternalTool[]): string =>
    ["GTKX cannot start a headless display without these tools:", "", ...missingToolLines(missing)].join("\n");

const resolveHeadlessExecutables = (): HeadlessExecutables => {
    const compositor = tryResolveExecutable(HEADLESS_DISPLAY_TOOLS.compositor.command);
    const bus = tryResolveExecutable(HEADLESS_DISPLAY_TOOLS.bus.command);

    if (compositor === undefined || bus === undefined) {
        throw new Error(
            missingToolsMessage([
                ...(compositor === undefined ? [HEADLESS_DISPLAY_TOOLS.compositor] : []),
                ...(bus === undefined ? [HEADLESS_DISPLAY_TOOLS.bus] : []),
            ]),
        );
    }

    return { bus, compositor };
};

const startCompositor = (executable: string, runtimeDir: string, options: HeadlessOptions): ChildProcess => {
    const [width = "", height = ""] = options.size.split("x", 2);
    const configPath = join(runtimeDir, "sway.conf");
    writeFileSync(configPath, createSwayConfig(width, height));

    return spawn(executable, ["-c", configPath], {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, [HEADLESS_HELPER_ENV]: runtimeDir },
    });
};

const noop = (): void => undefined;

const writeBusConfig = (busConfigPath: string, busSocketPath: string): void => {
    writeFileSync(busConfigPath, createBusConfig(busSocketPath));
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
        isRunning: () => child.exitCode === null && child.signalCode === null && isProcessAlive(child.pid),
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

const isMonitorReady = (monitor: ChildMonitor): boolean => monitor.isRunning() && existsSync(monitor.path);

const pendingMonitors = (monitors: ChildMonitor[]): ChildMonitor[] =>
    monitors.filter((monitor) => !isMonitorReady(monitor));

const isEveryMonitorReady = (monitors: ChildMonitor[]): boolean => monitors.every((monitor) => isMonitorReady(monitor));

const firstFailure = (monitors: ChildMonitor[]): string | undefined => {
    for (const monitor of monitors) {
        const failure = monitor.failure();

        if (failure !== undefined) {
            return failure;
        }
    }

    return undefined;
};

const SOCKET_TIMEOUT_MS = 15_000;

const missingMessage = (pending: ChildMonitor[], timeout: number): string =>
    `${pending.map((monitor) => monitor.label).join(", ")} did not become available within ${String(timeout)}ms\n` +
    pending.map((monitor) => monitor.read()).join("");

const watchForSockets = ({ options, resolve, reject }: SocketsWatch): void => {
    const { monitors, timeout = SOCKET_TIMEOUT_MS } = options;
    const cleanups: (() => void)[] = [];

    const stop = (): void => {
        runCleanups(cleanups);
    };

    const fail = (message: string): void => {
        stop();
        reject(new Error(message));
    };

    const alreadyFailed = firstFailure(monitors);

    if (alreadyFailed !== undefined) {
        fail(alreadyFailed);

        return;
    }

    const settle = (): void => {
        stop();
        resolve();
    };

    if (isEveryMonitorReady(monitors)) {
        settle();

        return;
    }

    const poll = setInterval(() => {
        if (isEveryMonitorReady(monitors)) {
            settle();
        }
    }, 10);

    const timer = setTimeout(() => {
        fail(missingMessage(pendingMonitors(monitors), timeout));
    }, timeout);

    cleanups.push(
        () => {
            clearInterval(poll);
            clearTimeout(timer);
        },
        ...monitors.map((monitor) => monitor.subscribe(fail)),
    );
};

const waitForSockets = (options: WaitForSocketsOptions): Promise<void> =>
    new Promise((resolve, reject) => {
        watchForSockets({ options, resolve, reject });
    });

const captureCompositorStderr = (child: ChildProcess, logPath: string): CapturedStderr => {
    const captured: string[] = [];
    const stderr = child.stderr;

    if (stderr === null) {
        return { chunks: captured, logPath, stop: noop };
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
        logPath,
        stop: () => {
            stderr.removeListener("data", onData);

            if (isOpen) {
                isOpen = false;
                closeSync(descriptor);
            }
        },
    };
};

const compositorExitMessage = (code: number | null, signal: NodeJS.Signals | null, captured: CapturedStderr): string =>
    `[gtkx] the headless compositor exited (code ${String(code)}, signal ${signal ?? "null"}); ` +
    "every Wayland client in this worker has been severed. " +
    `Its stderr log is kept at ${captured.logPath} until this worker exits.\n${captured.chunks.join("")}`;

const watchCompositorExit = (child: ChildProcess, captured: CapturedStderr): (() => void) => {
    const report = (code: number | null, signal: NodeJS.Signals | null): void => {
        process.stderr.write(compositorExitMessage(code, signal, captured));
    };

    child.on("exit", report);

    return () => child.removeListener("exit", report);
};

const waitForDisplaySockets = ({ compositorMonitor, busMonitor }: DisplaySockets): Promise<void> =>
    waitForSockets({ monitors: [busMonitor, compositorMonitor] });

const CONNECT_RETRY_MS = 10;

const pause = (duration: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, duration);
    });

const connectFailure = (path: string): Promise<Error | undefined> =>
    new Promise((resolve) => {
        const socket = connect(path);

        socket.once("connect", () => {
            socket.destroy();
            resolve(undefined);
        });

        socket.once("error", (cause: Error) => {
            socket.destroy();
            resolve(cause);
        });
    });

const unreachableMessage = (monitor: ChildMonitor, cause: Error): string =>
    `${monitor.label} did not accept a connection on ${monitor.path}: ${cause.message}\n${monitor.read()}`;

const waitUntilConnectable = async (monitor: ChildMonitor): Promise<void> => {
    const deadline = Date.now() + SOCKET_TIMEOUT_MS;

    for (;;) {
        const failure = await connectFailure(monitor.path);

        if (failure === undefined) {
            return;
        }

        if (!monitor.isRunning() || Date.now() >= deadline) {
            throw new Error(unreachableMessage(monitor, failure));
        }

        await pause(CONNECT_RETRY_MS);
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

const makeRemoveRuntime =
    (env: EnvSnapshot, runtime: HeadlessRuntime): (() => void) =>
    (): void => {
        restoreEnv(env);
        stopHeadlessRuntime(runtime);
    };

const startBus = (executable: string, runtimeDir: string, busSocketPath: string): ChildProcess => {
    const busConfigPath = join(runtimeDir, "session.conf");
    writeBusConfig(busConfigPath, busSocketPath);

    return spawn(executable, [`--config-file=${busConfigPath}`], {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, [HEADLESS_HELPER_ENV]: runtimeDir },
    });
};

const createHeadlessRuntime = (): HeadlessRuntime => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));

    try {
        chmodSync(runtimeDir, 0o700);
        const owner = readProcessIdentity(process.pid);
        if (owner === undefined) throw new Error("Cannot identify the headless display owner");
        const cleanupDirectory = cleanupDirectoryIdentity(runtimeDir);
        if (cleanupDirectory === undefined) throw new Error("Cannot identify the headless runtime directory");
        const markerPath = join(runtimeDir, HEADLESS_RUNTIME_MARKER);
        writeFileSync(markerPath, createHeadlessRuntimeMarker(runtimeDir, owner), { flag: "wx", mode: 0o600 });
        chmodSync(markerPath, 0o600);

        return { cleanupDirectory, owner, helpers: [] };
    } catch (error) {
        rmSync(runtimeDir, { recursive: true, force: true });
        throw error;
    }
};

const startHeadlessDisplay = async (options: HeadlessOptions): Promise<() => void> => {
    const executables = resolveHeadlessExecutables();
    const env: EnvSnapshot = {};
    const runtime = createHeadlessRuntime();
    const runtimeDir = runtime.cleanupDirectory.path;
    const spawned: ChildProcess[] = [];
    const monitorStops: (() => void)[] = [];
    const removeRuntime = makeRemoveRuntime(env, runtime);
    const recordChild = (child: ChildProcess): void => {
        spawned.push(child);
        child.unref();
        const identity = child.pid === undefined ? undefined : readProcessIdentity(child.pid);
        if (identity === undefined) return;
        runtime.helpers.push(identity);
        const pending = join(runtimeDir, `${HEADLESS_RUNTIME_MARKER}.tmp`);
        writeFileSync(pending, createHeadlessRuntimeMarker(runtimeDir, runtime.owner, runtime.helpers), {
            mode: 0o600,
        });
        renameSync(pending, join(runtimeDir, HEADLESS_RUNTIME_MARKER));
    };

    try {
        applyEnv(env, STATIC_HEADLESS_ENV);
        applyEnv(env, { XDG_RUNTIME_DIR: runtimeDir });
        const busSocketPath = join(runtimeDir, "bus");
        const busChild = startBus(executables.bus, runtimeDir, busSocketPath);
        recordChild(busChild);
        const busMonitor = monitorChild(busChild, "D-Bus session bus", busSocketPath);
        monitorStops.push(busMonitor.stop);
        applyEnv(env, { DBUS_SESSION_BUS_ADDRESS: `unix:path=${busSocketPath}` });
        applyEnv(env, COMPOSITOR_ENV);
        const compositor = startCompositor(executables.compositor, runtimeDir, options);
        recordChild(compositor);
        const compositorSocketPath = join(runtimeDir, COMPOSITOR_SOCKET);
        const compositorMonitor = monitorChild(compositor, "Compositor", compositorSocketPath);
        monitorStops.push(compositorMonitor.stop);
        applyEnv(env, { WAYLAND_DISPLAY: COMPOSITOR_SOCKET });
        await waitForDisplaySockets({ compositorMonitor, busMonitor });
        await waitUntilConnectable(busMonitor);
        await waitUntilConnectable(compositorMonitor);
        const stopVirtualSeat = await startVirtualSeat(compositorSocketPath);
        const stopNotifications = await startNotificationService(`unix:path=${busSocketPath}`);
        runCleanups(monitorStops);
        const capturedStderr = captureCompositorStderr(compositor, join(runtimeDir, "compositor.stderr.log"));
        const stopExitWatch = watchCompositorExit(compositor, capturedStderr);

        return makeTeardown([
            stopExitWatch,
            capturedStderr.stop,
            stopVirtualSeat,
            stopNotifications,
            removeRuntime,
            () => killSpawned(spawned),
        ]);
    } catch (error) {
        runCleanups(monitorStops);
        removeRuntime();
        killSpawned(spawned);
        throw error;
    }
};

export {
    STATIC_HEADLESS_ENV,
    resolveHeadlessExecutables,
    resolveHeadlessOptions,
    readHeadlessOptions,
    startHeadlessDisplay,
    type HeadlessOptions,
};
