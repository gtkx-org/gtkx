import { type ChildProcess, type StdioOptions, spawn, spawnSync } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

type CompositorId = "sway" | "weston";

export const DEFAULT_HEADLESS_SIZE = "1024x768";

export type HeadlessOptions = {
    size: string;
    compositor: CompositorId;
};

const DEFAULT_HEADLESS_COMPOSITOR: CompositorId = "weston";

export const resolveHeadlessOptions = (provided: Partial<HeadlessOptions>): HeadlessOptions => ({
    size: provided.size ?? DEFAULT_HEADLESS_SIZE,
    compositor: provided.compositor ?? DEFAULT_HEADLESS_COMPOSITOR,
});

type EnvSnapshot = { [name: string]: string | undefined };

const applyEnv = (snapshot: EnvSnapshot, values: { [name: string]: string }): void => {
    for (const [name, value] of Object.entries(values)) {
        if (!(name in snapshot)) snapshot[name] = process.env[name];
        process.env[name] = value;
    }
};

const restoreEnv = (snapshot: EnvSnapshot): void => {
    for (const [name, previous] of Object.entries(snapshot)) {
        if (previous === undefined) delete process.env[name];
        else process.env[name] = previous;
    }
};

const spawnWithParentDeathSignal = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
    const child = spawn("setpriv", ["--pdeathsig", "SIGKILL", command, ...args], { stdio });
    child.unref();
    return child;
};

let westonFakeSeatSupport: boolean | undefined;

const westonSupportsFakeSeat = (): boolean => {
    if (westonFakeSeatSupport === undefined) {
        const help = spawnSync("weston", ["--help"], { encoding: "utf8" });
        westonFakeSeatSupport = `${help.stdout ?? ""}${help.stderr ?? ""}`.includes("--fake-seat");
    }
    return westonFakeSeatSupport;
};

type CompositorDescriptor = {
    socket: string;
    env: { [name: string]: string };
    start: (runtimeDir: string, width: string, height: string) => ChildProcess;
};

const compositorRegistry: { [K in CompositorId]: CompositorDescriptor } = {
    sway: {
        socket: "wayland-1",
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
        env: {},
        start: (_runtimeDir, width, height) =>
            spawnWithParentDeathSignal(
                "weston",
                [
                    "--backend=headless",
                    "--renderer=pixman",
                    ...(westonSupportsFakeSeat() ? ["--fake-seat"] : []),
                    `--width=${width}`,
                    `--height=${height}`,
                    "--socket=wayland-0",
                ],
                ["ignore", "ignore", "pipe"],
            ),
    },
};

const isCompositorId = (value: string): value is CompositorId => Object.hasOwn(compositorRegistry, value);

export const readHeadlessOptions = (params: URLSearchParams): Partial<HeadlessOptions> => {
    const options: Partial<HeadlessOptions> = {};
    const size = params.get("size");
    if (size !== null) options.size = size;
    const compositor = params.get("compositor");
    if (compositor !== null && isCompositorId(compositor)) options.compositor = compositor;
    return options;
};

type SpawnedCompositor = {
    child: ChildProcess;
    socket: string;
};

const startCompositor = (runtimeDir: string, options: HeadlessOptions, env: EnvSnapshot): SpawnedCompositor => {
    const descriptor = compositorRegistry[options.compositor];

    const [width = "", height = ""] = options.size.split("x");
    applyEnv(env, descriptor.env);

    return { child: descriptor.start(runtimeDir, width, height), socket: descriptor.socket };
};

const writeBusConfig = (busConfigPath: string, busSocketPath: string): void => {
    writeFileSync(
        busConfigPath,
        `<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <listen>unix:path=${busSocketPath}</listen>
  <auth>EXTERNAL</auth>
  <policy context="default">
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>`,
    );
};

type WaitForSocketOptions = {
    label: string;
    timeout?: number;
    child?: ChildProcess;
    signal?: AbortSignal;
};

const waitForSocket = (path: string, { label, timeout = 15000, child, signal }: WaitForSocketOptions): Promise<void> =>
    new Promise((resolve, reject) => {
        let log = "";
        const stderr = child?.stderr ?? null;
        stderr?.setEncoding("utf8");
        stderr?.on("data", (chunk: string) => {
            log += chunk;
        });
        let timer: ReturnType<typeof setTimeout>;
        let poll: ReturnType<typeof setInterval>;
        const stopListening = (): void => {
            clearTimeout(timer);
            clearInterval(poll);
            child?.removeListener("exit", onExit);
            child?.removeListener("error", onError);
            signal?.removeEventListener("abort", onAbort);
            stderr?.removeAllListeners("data");
            stderr?.resume();
            if (stderr instanceof Socket) stderr.unref();
        };
        const onExit = (code: number | null, terminationSignal: NodeJS.Signals | null): void => {
            stopListening();
            reject(
                new Error(
                    `${label} exited (code ${code ?? "null"}, signal ${terminationSignal ?? "null"}) before ${path} appeared\n${log}`,
                ),
            );
        };
        const onError = (cause: Error): void => {
            stopListening();
            reject(new Error(`${label} failed to spawn: ${cause.message}\n${log}`));
        };
        const onAbort = (): void => {
            stopListening();
            reject(new Error(`${label} startup aborted before ${path} appeared`));
        };
        poll = setInterval(() => {
            if (existsSync(path)) {
                stopListening();
                resolve();
            }
        }, 50);
        timer = setTimeout(() => {
            stopListening();
            const suffix = child ? `\n${log}` : "";
            reject(new Error(`${label} did not become available within ${timeout}ms${suffix}`));
        }, timeout);
        child?.on("exit", onExit);
        child?.on("error", onError);
        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener("abort", onAbort);
        }
    });

export const STATIC_HEADLESS_ENV = {
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

const captureCompositorStderr = (child: ChildProcess, logPath: string): string[] => {
    const captured: string[] = [];
    const stderr = child.stderr;
    if (stderr !== null) {
        stderr.setEncoding("utf8");
        const logStream = createWriteStream(logPath);
        // A fast-exiting worker can remove the runtime dir before this stream's
        // async open resolves; the log is best-effort, so ignore write failures.
        logStream.on("error", () => {});
        stderr.on("data", (chunk: string) => {
            captured.push(chunk);
            logStream.write(chunk);
        });
    }
    return captured;
};

/**
 * When the compositor dies on its own (e.g. an OOM-killer SIGKILL) the worker's
 * in-process GDK client loses its Wayland socket and aborts, surfacing only as
 * an opaque "Worker exited unexpectedly". Teardown always runs, so if the
 * compositor has already exited by then it was not us that killed it — surface
 * its exit code/signal and captured stderr to make the cause observable.
 */
const reportUnexpectedCompositorExit = (child: ChildProcess, capturedStderr: string[]): void => {
    if (child.exitCode === null && child.signalCode === null) return;
    process.stderr.write(
        `[gtkx] headless compositor died before teardown (code ${child.exitCode ?? "null"}, ` +
            `signal ${child.signalCode ?? "null"}); the worker's Wayland client was severed.\n${capturedStderr.join("")}`,
    );
};

const makeTeardown = (
    spawned: ChildProcess[],
    compositor: ChildProcess,
    capturedStderr: string[],
    removeRuntime: () => void,
): (() => void) => {
    let torndown = false;
    return (): void => {
        if (torndown) return;
        torndown = true;
        reportUnexpectedCompositorExit(compositor, capturedStderr);
        for (const child of spawned) child.kill("SIGKILL");
        removeRuntime();
    };
};

export const startHeadlessDisplay = async (options: HeadlessOptions): Promise<() => void> => {
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

        const abort = new AbortController();
        try {
            await Promise.all([
                waitForSocket(join(runtimeDir, compositor.socket), {
                    label: "Compositor",
                    child: compositor.child,
                    signal: abort.signal,
                }),
                waitForSocket(busSocketPath, { label: "D-Bus session bus", child: busChild, signal: abort.signal }),
            ]);
        } finally {
            abort.abort();
        }

        const capturedStderr = captureCompositorStderr(compositor.child, join(runtimeDir, "weston.stderr.log"));
        return makeTeardown(spawned, compositor.child, capturedStderr, removeRuntime);
    } catch (cause) {
        for (const child of spawned) child.kill("SIGKILL");
        removeRuntime();
        throw cause;
    }
};
