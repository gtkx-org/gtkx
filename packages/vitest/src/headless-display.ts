import { type ChildProcess, type StdioOptions, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CompositorId = "sway" | "weston";

export const DEFAULT_HEADLESS_SIZE = "1024x768";

export type HeadlessOptions = {
    size: string;
    compositor: CompositorId;
};

const spawnWorkerChild = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
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
                    ...(westonSupportsFakeSeat() ? ["--fake-seat"] : []),
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

export type HeadlessTeardown = () => void;

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
