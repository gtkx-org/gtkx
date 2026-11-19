import { type ChildProcess, execFile, execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const OUTPUT = "HEADLESS-1";
const SCALE = 2;
const FRAME_RATE = 30;
const QUALITY = 36;
const FRAME_BUFFER = 64 * 1024 * 1024;

type ClipSize = { width: number; height: number };

type ClipFiles = { video: string; poster: string };

type OutputWatch = { next: (marker: string, timeout: number) => Promise<void> };

const swaySocket = (): string => {
    const runtimeDir = process.env.XDG_RUNTIME_DIR;
    const socket =
        runtimeDir === undefined
            ? undefined
            : readdirSync(runtimeDir).find((name) => /^sway-ipc\..*\.sock$/.test(name));

    if (runtimeDir === undefined || socket === undefined) {
        throw new Error("The headless display has no Sway IPC socket");
    }

    return join(runtimeDir, socket);
};

const sway = (command: string): void => {
    execFileSync("swaymsg", ["-s", swaySocket(), command], { stdio: "pipe" });
};

/**
 * Sizes the headless output to one window at {@link SCALE}, so a tiled window is the whole frame.
 */
const fitDisplay = ({ width, height }: ClipSize): void => {
    sway(`output ${OUTPUT} resolution ${width * SCALE}x${height * SCALE} scale ${SCALE}`);
};

/**
 * Tiles every window, which makes it fill the output without a shadow or rounded corners.
 */
const fillDisplay = (): void => {
    sway('[title=".*"] floating disable');
};

const finished = async (child: ChildProcess, label: string): Promise<void> => {
    const [code] = (await once(child, "close")) as [number | null];

    if (code !== 0) {
        throw new Error(`${label} exited with code ${String(code)}`);
    }
};

const encode = async (raw: string, { video, poster }: ClipFiles, workDir: string): Promise<void> => {
    const pass = (number: string, target: string[]): Promise<unknown> =>
        run("ffmpeg", [
            "-loglevel",
            "error",
            "-y",
            "-i",
            raw,
            "-vf",
            `fps=${FRAME_RATE}`,
            "-an",
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "0",
            "-crf",
            String(QUALITY),
            "-row-mt",
            "1",
            "-passlogfile",
            join(workDir, "pass"),
            "-pass",
            number,
            ...target,
        ]);

    await pass("1", ["-f", "null", "/dev/null"]);
    await pass("2", [video]);
    await run("ffmpeg", ["-loglevel", "error", "-y", "-sseof", "-1", "-i", raw, "-update", "1", poster]);
};

/**
 * Records the headless output while `performance` runs, then writes the clip and its last frame as a poster.
 *
 * Frames are stamped with their arrival time, so an uneven capture rate does not change the clip's pace.
 */
const recordClip = async (files: ClipFiles, performance: () => Promise<void>): Promise<void> => {
    const workDir = mkdtempSync(join(tmpdir(), "gtkx-clip-"));
    const raw = join(workDir, "raw.mkv");
    const encoder = spawn(
        "ffmpeg",
        [
            "-loglevel",
            "error",
            "-y",
            "-use_wallclock_as_timestamps",
            "1",
            "-f",
            "image2pipe",
            "-c:v",
            "ppm",
            "-i",
            "-",
            "-fps_mode",
            "vfr",
            "-c:v",
            "ffv1",
            raw,
        ],
        { stdio: ["pipe", "ignore", "inherit"] },
    );
    const encoded = finished(encoder, "The frame encoder");
    let isRecording = true;
    let frameCount = 0;

    const capture = async (): Promise<void> => {
        while (isRecording) {
            const { stdout } = await run("grim", ["-t", "ppm", "-"], {
                encoding: "buffer",
                maxBuffer: FRAME_BUFFER,
            });

            frameCount += 1;

            if (!encoder.stdin.write(stdout)) {
                await once(encoder.stdin, "drain");
            }
        }
    };

    try {
        const startedAt = Date.now();
        const frames = capture();
        frames.catch(() => undefined);

        try {
            await performance();
        } finally {
            isRecording = false;
            await frames.finally(() => encoder.stdin.end());
        }

        const captureRate = (frameCount * 1000) / (Date.now() - startedAt);

        if (captureRate < FRAME_RATE) {
            throw new Error(
                `Captured ${captureRate.toFixed(1)} frames a second, below the clip's ${FRAME_RATE}: record on an idle machine`,
            );
        }

        await encoded;
        await encode(raw, files, workDir);
    } finally {
        encoder.kill();
        await encoded.catch(() => undefined);
        rmSync(workDir, { recursive: true, force: true });
    }
};

/**
 * Follows a child's output and resolves each `next` call once `marker` appears after the previous match.
 */
const watchOutput = (child: ChildProcess): OutputWatch => {
    let text = "";
    let offset = 0;
    let hasEnded = false;
    let notify: (() => void) | undefined;

    const onData = (chunk: string): void => {
        text += chunk;
        notify?.();
    };

    for (const stream of [child.stdout, child.stderr]) {
        stream?.setEncoding("utf8").on("data", onData);
    }

    const onEnd = (): void => {
        hasEnded = true;
        notify?.();
    };

    child.once("exit", onEnd).once("error", onEnd);

    const next = async (marker: string, timeout: number): Promise<void> => {
        const deadline = Date.now() + timeout;

        for (;;) {
            const index = text.indexOf(marker, offset);

            if (index !== -1) {
                offset = index + marker.length;
                return;
            }

            const remaining = deadline - Date.now();

            if (hasEnded || remaining <= 0) {
                throw new Error(`"${marker}" did not appear in the output:\n${text.slice(offset)}`);
            }

            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, remaining);
                notify = () => {
                    clearTimeout(timer);
                    resolve();
                };
            });
        }
    };

    return { next };
};

export { type ClipFiles, type ClipSize, fillDisplay, fitDisplay, recordClip, watchOutput };
