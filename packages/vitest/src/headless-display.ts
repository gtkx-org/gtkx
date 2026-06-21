import { type ChildProcess, type StdioOptions, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The set of compositor identifiers a headless display can launch.
 */
export type CompositorId = "sway" | "weston";

/**
 * The default compositor output size, used when no size is requested.
 */
export const DEFAULT_HEADLESS_SIZE = "1024x768";

/**
 * Options controlling how the per-worker headless display environment is started.
 */
export type HeadlessOptions = {
    /**
     * Requested compositor output size formatted as `WIDTHxHEIGHT` (for example `1024x768`).
     */
    size: string;
    /**
     * Identifier of the compositor to launch.
     */
    compositor: CompositorId;
};

const spawnWorkerChild = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
    const child = spawn("setpriv", ["--pdeathsig", "SIGKILL", command, ...args], { stdio });
    child.unref();
    return child;
};

/**
 * A launched compositor, describing how to start it and the Wayland socket it serves.
 */
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
            return spawnWorkerChild("sway", ["-c", configPath], ["ignore", "ignore", "pipe"]);
        },
    },
    weston: {
        socket: "wayland-0",
        env: {},
        start: (_runtimeDir, width, height) =>
            spawnWorkerChild(
                "weston",
                [
                    "--backend=headless",
                    "--renderer=pixman",
                    "--fake-seat",
                    `--width=${width}`,
                    `--height=${height}`,
                    "--socket=wayland-0",
                ],
                ["ignore", "ignore", "pipe"],
            ),
    },
};

type SpawnedCompositor = {
    child: ChildProcess;
    socket: string;
};

/**
 * Launches the configured compositor in the given runtime directory, applying its
 * environment contract and returning the spawned child plus the Wayland socket it serves.
 *
 * @param runtimeDir - The private XDG runtime directory to launch the compositor in.
 * @param options - The requested compositor size and compositor selection.
 * @returns The spawned compositor child and the Wayland socket name it serves.
 * @throws TypeError when `options.compositor` is not a known compositor id.
 */
export const startCompositor = (runtimeDir: string, options: HeadlessOptions): SpawnedCompositor => {
    const descriptor = compositorRegistry[options.compositor];
    if (!descriptor) {
        throw new TypeError(`Unknown compositor "${options.compositor}"; expected one of: sway, weston`);
    }

    const [width, height] = (options.size || DEFAULT_HEADLESS_SIZE).split("x");
    for (const [name, value] of Object.entries(descriptor.env)) {
        process.env[name] = value;
    }

    return { child: descriptor.start(runtimeDir, width ?? "", height ?? ""), socket: descriptor.socket };
};

/**
 * Writes a D-Bus session bus configuration file that listens on the given socket
 * path with EXTERNAL authentication and a permissive default policy.
 *
 * @param busConfigPath - The path to write the bus configuration file to.
 * @param busSocketPath - The Unix socket path the bus should listen on.
 */
export const writeBusConfig = (busConfigPath: string, busSocketPath: string): void => {
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
};

/**
 * Resolves once `path` exists on disk, polling at a fixed interval. When a `child`
 * process is supplied, rejects early with the child's captured stderr if it exits
 * before the path appears, and rejects on timeout otherwise.
 *
 * @param path - The filesystem path to wait for.
 * @param options - The diagnostic label, optional timeout, and optional child to watch.
 * @returns A promise that resolves when the path appears or rejects on exit/timeout.
 */
export const waitForSocket = (path: string, { label, timeout = 15000, child }: WaitForSocketOptions): Promise<void> =>
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
            stderr?.removeAllListeners("data");
            stderr?.resume();
            if (stderr instanceof Socket) stderr.unref();
        };
        const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
            stopListening();
            reject(
                new Error(
                    `${label} exited (code ${code ?? "null"}, signal ${signal ?? "null"}) before ${path} appeared\n${log}`,
                ),
            );
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
    });

/**
 * A callback that tears down the resources provisioned by {@link startHeadlessDisplay}:
 * it kills the compositor and bus children and removes the private XDG runtime directory.
 */
export type HeadlessTeardown = () => void;

/**
 * Starts an isolated, per-worker headless display environment: a private XDG runtime
 * directory, a dedicated D-Bus session bus, and a headless Wayland compositor, exporting
 * the environment variables that GTK and GSK need to render in software. Resolves once both
 * the bus and the compositor socket are ready.
 *
 * @param options - The requested compositor size and compositor selection.
 * @returns A promise resolving to a teardown callback that kills the spawned children and
 *   removes the private runtime directory.
 */
export const startHeadlessDisplay = async (options: HeadlessOptions): Promise<HeadlessTeardown> => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));
    chmodSync(runtimeDir, 0o700);
    process.env["XDG_RUNTIME_DIR"] = runtimeDir;

    const busConfigPath = join(runtimeDir, "session.conf");
    const busSocketPath = join(runtimeDir, "bus");
    writeBusConfig(busConfigPath, busSocketPath);

    const busChild = spawnWorkerChild("dbus-daemon", [`--config-file=${busConfigPath}`], ["ignore", "ignore", "pipe"]);
    process.env["DBUS_SESSION_BUS_ADDRESS"] = `unix:path=${busSocketPath}`;

    const compositor = startCompositor(runtimeDir, options);

    process.env["WAYLAND_DISPLAY"] = compositor.socket;
    process.env["GDK_BACKEND"] = "wayland";
    process.env["GDK_DISABLE"] = "vulkan";
    process.env["GSK_RENDERER"] = "cairo";
    process.env["GTK_A11Y"] = "test";
    process.env["LIBGL_ALWAYS_SOFTWARE"] = "1";
    process.env["GSETTINGS_BACKEND"] = "memory";

    await Promise.all([
        waitForSocket(join(runtimeDir, compositor.socket), { label: "Compositor", child: compositor.child }),
        waitForSocket(busSocketPath, { label: "D-Bus session bus", child: busChild }),
    ]);

    return () => {
        compositor.child.kill("SIGKILL");
        busChild.kill("SIGKILL");
        rmSync(runtimeDir, { recursive: true, force: true });
    };
};
