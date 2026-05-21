import { type ChildProcess, type StdioOptions, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";

const busDir = mkdtempSync(join(tmpdir(), "gtkx-dbus-"));
const busConfigPath = join(busDir, "session.conf");
const busSocketPath = join(busDir, "bus");

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
 * signal handlers cannot cover. Without it a crashed worker orphans its `Xvfb`
 * and `dbus-daemon`, leaking one of each per crash.
 */
const spawnWorkerChild = (command: string, args: string[], stdio: StdioOptions): ChildProcess => {
    const child = spawn("setpriv", ["--pdeathsig", "SIGKILL", command, ...args], { stdio });
    child.unref();
    return child;
};

const xvfb = spawnWorkerChild("Xvfb", ["-displayfd", "1", "-screen", "0", "1024x768x24"], ["ignore", "pipe", "pipe"]);
const dbus = spawnWorkerChild("dbus-daemon", [`--config-file=${busConfigPath}`], "ignore");

process.env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${busSocketPath}`;
process.env.GDK_BACKEND = "x11";
process.env.GDK_DISABLE = "vulkan";
process.env.GSK_RENDERER = "cairo";
process.env.GTK_A11Y = "test";
process.env.LIBGL_ALWAYS_SOFTWARE = "1";
process.env.GSETTINGS_BACKEND = "memory";

const killChildren = (): void => {
    if (xvfb.pid !== undefined) {
        try {
            process.kill(xvfb.pid, "SIGTERM");
        } catch {}
    }
    if (dbus.pid !== undefined) {
        try {
            process.kill(dbus.pid, "SIGTERM");
        } catch {}
    }
    try {
        rmSync(busDir, { recursive: true, force: true });
    } catch {}
};

process.on("exit", killChildren);

process.on("SIGTERM", () => {
    killChildren();
    process.exit(143);
});

process.on("SIGINT", () => {
    killChildren();
    process.exit(130);
});

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
 * Resolves with the display number Xvfb chose, reported on its `-displayfd`.
 *
 * Letting Xvfb scan for and claim a free display — rather than computing one
 * from the worker PID — removes collisions between the many worker `Xvfb`
 * instances a `turbo` run starts concurrently. The number is written only once
 * the server owns the display and accepts connections, so it is usable as soon
 * as it arrives. An early server exit is surfaced with its captured log instead
 * of stalling until the timeout elapses.
 */
const waitForDisplay = (timeout = 15000): Promise<string> =>
    new Promise((resolve, reject) => {
        const { stdout, stderr } = xvfb;
        if (stdout === null || stderr === null) {
            reject(new Error("Xvfb output pipes are unavailable"));
            return;
        }
        stdout.setEncoding("utf8");
        stderr.setEncoding("utf8");
        let displayBuffer = "";
        let log = "";
        let timer: ReturnType<typeof setTimeout>;
        const stopListening = (): void => {
            clearTimeout(timer);
            stdout.removeAllListeners("data");
            stderr.removeAllListeners("data");
            xvfb.removeAllListeners("exit");
        };
        const drain = (stream: Readable): void => {
            stream.resume();
            (stream as Partial<{ unref(): void }>).unref?.();
        };
        const onDisplay = (chunk: string): void => {
            displayBuffer += chunk;
            const newline = displayBuffer.indexOf("\n");
            if (newline === -1) {
                return;
            }
            stopListening();
            drain(stdout);
            drain(stderr);
            resolve(displayBuffer.slice(0, newline).trim());
        };
        const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
            stopListening();
            reject(
                new Error(
                    `Xvfb exited (code ${code ?? "null"}, signal ${signal ?? "null"}) before reporting a display\n${log}`,
                ),
            );
        };
        timer = setTimeout(() => {
            stopListening();
            reject(new Error(`Xvfb did not report a display within ${timeout}ms\n${log}`));
        }, timeout);
        stdout.on("data", onDisplay);
        stderr.on("data", (chunk: string) => {
            log += chunk;
        });
        xvfb.on("exit", onExit);
    });

const [display] = await Promise.all([waitForDisplay(), waitForFile(busSocketPath, "D-Bus session bus")]);
process.env.DISPLAY = `:${display}`;
