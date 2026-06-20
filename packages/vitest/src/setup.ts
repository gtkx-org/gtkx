import { type ChildProcess, type StdioOptions, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));
chmodSync(runtimeDir, 0o700);
process.env.XDG_RUNTIME_DIR = runtimeDir;

const busConfigPath = join(runtimeDir, "session.conf");
const busSocketPath = join(runtimeDir, "bus");

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

/**
 * Spawns a long-lived helper process whose lifetime is bound to this worker.
 *
 * `setpriv --pdeathsig SIGKILL` makes the kernel kill the helper the instant
 * the worker process dies — by any signal, including a `SIGSEGV` from a native
 * crash or a `SIGKILL` from the OOM killer — paths that `process.on` exit and
 * signal handlers cannot cover. Without it a crashed worker orphans its
 * compositor and `dbus-daemon`, leaking one of each per crash.
 */
const spawnWorkerChild = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
    const child = spawn("setpriv", ["--pdeathsig", "SIGKILL", command, ...args], { stdio });
    child.unref();
    return child;
};

spawnWorkerChild("dbus-daemon", [`--config-file=${busConfigPath}`], "ignore");
process.env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${busSocketPath}`;

const [width, height] = (process.env.GTKX_HEADLESS_SIZE ?? "1024x768").split("x");

/**
 * Launches the per-worker headless Wayland compositor that GTK realizes its
 * windows against, returning the `WAYLAND_DISPLAY` socket name it listens on.
 *
 * `weston` (the default) is the lightest multi-client headless compositor and
 * is what every test path uses, since `@gtkx/testing` synthesizes input by
 * emitting controller signals and captures screenshots in-process — neither
 * touches the compositor's input or output. `sway` is selected through
 * `GTKX_COMPOSITOR=sway` only by the website asset pipeline, which needs the
 * `wlr-screencopy` protocol (for `grim`/`wf-recorder`) that weston does not
 * implement; its single `HEADLESS-1` output is sized to match and its windows
 * float at their natural size so a full-output grab matches an X server's.
 */
const startCompositor = (): { child: ChildProcess; socket: string } => {
    if (process.env.GTKX_COMPOSITOR === "sway") {
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
        process.env.WLR_BACKENDS = "headless";
        process.env.WLR_RENDERER = "pixman";
        process.env.WLR_RENDERER_ALLOW_SOFTWARE = "1";
        process.env.WLR_LIBINPUT_NO_DEVICES = "1";
        process.env.WLR_HEADLESS_OUTPUTS = "1";
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

const compositor = startCompositor();

process.env.WAYLAND_DISPLAY = compositor.socket;
process.env.GDK_BACKEND = "wayland";
process.env.GDK_DISABLE = "vulkan";
process.env.GSK_RENDERER = "cairo";
process.env.GTK_A11Y = "test";
process.env.LIBGL_ALWAYS_SOFTWARE = "1";
process.env.GSETTINGS_BACKEND = "memory";

const waitForFile = async (path: string, label: string, timeout = 15000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (existsSync(path)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`${label} did not become available within ${timeout}ms`);
};

/**
 * Resolves once the compositor's Wayland socket appears, or rejects with the
 * captured log if the compositor exits first.
 *
 * Polling for the socket file — rather than parsing compositor stdout — works
 * uniformly across weston and sway, since the socket is created only once the
 * compositor accepts connections. An early exit is surfaced with its captured
 * `stderr` instead of stalling until the timeout elapses.
 */
const waitForCompositor = (child: ChildProcess, socketPath: string, timeout = 15000): Promise<void> =>
    new Promise((resolve, reject) => {
        let log = "";
        const { stderr } = child;
        stderr?.setEncoding("utf8");
        stderr?.on("data", (chunk: string) => {
            log += chunk;
        });
        let timer: ReturnType<typeof setTimeout>;
        let poll: ReturnType<typeof setInterval>;
        const stopListening = (): void => {
            clearTimeout(timer);
            clearInterval(poll);
            child.removeListener("exit", onExit);
            stderr?.removeAllListeners("data");
            stderr?.resume();
            (stderr as Partial<{ unref(): void }> | null)?.unref?.();
        };
        const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
            stopListening();
            reject(
                new Error(
                    `Compositor exited (code ${code ?? "null"}, signal ${signal ?? "null"}) before its socket appeared\n${log}`,
                ),
            );
        };
        poll = setInterval(() => {
            if (existsSync(socketPath)) {
                stopListening();
                resolve();
            }
        }, 50);
        timer = setTimeout(() => {
            stopListening();
            reject(new Error(`Compositor did not create ${socketPath} within ${timeout}ms\n${log}`));
        }, timeout);
        child.on("exit", onExit);
    });

await Promise.all([
    waitForCompositor(compositor.child, join(runtimeDir, compositor.socket)),
    waitForFile(busSocketPath, "D-Bus session bus"),
]);
