import { type ChildProcess, type StdioOptions, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Options controlling how the per-worker headless display environment is started.
 */
export type HeadlessOptions = {
    /**
     * Requested compositor output size formatted as `WIDTHxHEIGHT` (for example `1024x768`).
     */
    size: string;
    /**
     * Identifier of the compositor to launch; `sway` selects Sway, any other value selects Weston.
     */
    compositor: string;
};

type SpawnedCompositor = {
    child: ChildProcess;
    socket: string;
};

const spawnWorkerChild = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
    const child = spawn("setpriv", ["--pdeathsig", "SIGKILL", command, ...args], { stdio });
    child.unref();
    return child;
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

const startCompositor = (runtimeDir: string, options: HeadlessOptions): SpawnedCompositor => {
    const [width, height] = (options.size || "1024x768").split("x");

    if (options.compositor === "sway") {
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
        process.env["WLR_BACKENDS"] = "headless";
        process.env["WLR_RENDERER"] = "pixman";
        process.env["WLR_RENDERER_ALLOW_SOFTWARE"] = "1";
        process.env["WLR_LIBINPUT_NO_DEVICES"] = "1";
        process.env["WLR_HEADLESS_OUTPUTS"] = "1";
        return {
            child: spawnWorkerChild("sway", ["-c", configPath], ["ignore", "ignore", "pipe"]),
            socket: "wayland-1",
        };
    }

    const socket = "wayland-0";
    const child = spawnWorkerChild(
        "weston",
        [
            "--backend=headless",
            "--renderer=pixman",
            "--fake-seat",
            `--width=${width}`,
            `--height=${height}`,
            `--socket=${socket}`,
        ],
        ["ignore", "ignore", "pipe"],
    );
    return { child, socket };
};

type WaitForSocketOptions = {
    label: string;
    timeout?: number;
    child?: ChildProcess;
};

const waitForSocket = (path: string, { label, timeout = 15000, child }: WaitForSocketOptions): Promise<void> =>
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
            (stderr as Partial<{ unref(): void }> | null)?.unref?.();
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
 * Starts an isolated, per-worker headless display environment: a private XDG runtime
 * directory, a dedicated D-Bus session bus, and a headless Wayland compositor, exporting
 * the environment variables that GTK and GSK need to render in software. Resolves once both
 * the bus and the compositor socket are ready.
 *
 * @param options - The requested compositor size and compositor selection.
 * @returns A promise that resolves once the display environment is ready.
 */
export const startHeadlessDisplay = async (options: HeadlessOptions): Promise<void> => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));
    chmodSync(runtimeDir, 0o700);
    process.env["XDG_RUNTIME_DIR"] = runtimeDir;

    const busConfigPath = join(runtimeDir, "session.conf");
    const busSocketPath = join(runtimeDir, "bus");
    writeBusConfig(busConfigPath, busSocketPath);

    spawnWorkerChild("dbus-daemon", [`--config-file=${busConfigPath}`], "ignore");
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
        waitForSocket(busSocketPath, { label: "D-Bus session bus" }),
    ]);
};
