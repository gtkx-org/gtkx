/**
 * Headless Wayland helpers for the website asset pipeline.
 *
 * The asset scripts that drive a standalone app (the showcase grabs, the hero
 * video) bring up their own throwaway `sway` compositor here, then capture its
 * single `HEADLESS-1` output with `grim` (still frames) or `wf-recorder`
 * (video) — the wlroots screen-copy tools a headless `sway` exposes and weston
 * does not. The worker-driven stages (the tutorial screenshots and the hero
 * editor) instead capture the `@gtkx/vitest` worker's own `sway` output, which
 * `GTKX_COMPOSITOR=sway` selects, by calling `grabOutput`/`startOutputRecorder`
 * with the inherited environment.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HEADLESS_OUTPUT = "HEADLESS-1";
const WAYLAND_DISPLAY = "wayland-1";

export interface HeadlessCompositor {
    /** Environment a GTK client or capture tool needs to reach this compositor. */
    readonly env: NodeJS.ProcessEnv;
    /** Terminates the compositor. */
    dispose(): void;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitForSocket = async (path: string, timeout = 15000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (existsSync(path)) return;
        await sleep(50);
    }
    throw new Error(`Headless compositor did not create ${path} within ${timeout}ms`);
};

/**
 * Starts a throwaway headless `sway` sized to `width`×`height` on a private
 * `XDG_RUNTIME_DIR`, resolving once its Wayland socket accepts connections.
 * Windows float at their natural size with no decorations so a full-output
 * grab matches what an X server produced.
 */
export const startHeadlessCompositor = async (width: number, height: number): Promise<HeadlessCompositor> => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-asset-xdg-"));
    chmodSync(runtimeDir, 0o700);
    const configPath = join(runtimeDir, "sway.conf");
    writeFileSync(
        configPath,
        [
            "xwayland disable",
            "default_border none",
            "default_floating_border none",
            `output ${HEADLESS_OUTPUT} resolution ${width}x${height}`,
            `output ${HEADLESS_OUTPUT} bg #000000 solid_color`,
            'for_window [app_id=".*"] floating enable, border none',
            'for_window [title=".*"] floating enable, border none',
            "",
        ].join("\n"),
    );
    const sway = spawn("sway", ["-c", configPath], {
        stdio: ["ignore", "ignore", "inherit"],
        env: {
            ...process.env,
            XDG_RUNTIME_DIR: runtimeDir,
            WLR_BACKENDS: "headless",
            WLR_RENDERER: "pixman",
            WLR_RENDERER_ALLOW_SOFTWARE: "1",
            WLR_LIBINPUT_NO_DEVICES: "1",
            WLR_HEADLESS_OUTPUTS: "1",
        },
    });
    await waitForSocket(join(runtimeDir, WAYLAND_DISPLAY));
    return {
        env: {
            ...process.env,
            XDG_RUNTIME_DIR: runtimeDir,
            WAYLAND_DISPLAY,
            GDK_BACKEND: "wayland",
        },
        dispose() {
            sway.kill("SIGTERM");
        },
    };
};

/** Captures the full `HEADLESS-1` output to a PNG with `grim`. */
export const grabOutput = (path: string, env: NodeJS.ProcessEnv = process.env): void => {
    try {
        execFileSync("grim", ["-o", HEADLESS_OUTPUT, path], { env, stdio: ["ignore", "ignore", "pipe"] });
    } catch (error) {
        const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
        throw new Error(`grim failed to capture ${HEADLESS_OUTPUT}${stderr ? `: ${stderr}` : ""}`);
    }
};

/**
 * Starts recording the full `HEADLESS-1` output to a visually lossless H.264
 * file (`yuv444p`, `crf=0`) with `wf-recorder`. Send the returned process
 * `SIGINT` to finalize the file.
 */
export const startOutputRecorder = (path: string, env: NodeJS.ProcessEnv = process.env): ChildProcess =>
    spawn(
        "wf-recorder",
        [
            "--no-dmabuf",
            "-o",
            HEADLESS_OUTPUT,
            "-r",
            "30",
            "-c",
            "libx264",
            "-x",
            "yuv444p",
            "-p",
            "crf=0",
            "-p",
            "preset=ultrafast",
            "-f",
            path,
        ],
        { stdio: ["ignore", "ignore", "inherit"], env },
    );
