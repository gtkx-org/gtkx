/**
 * Records and encodes the hero demo: a GTKX-built code editor types two style
 * edits into the tutorial's note-card component and saves them, while the
 * tutorial Notes app runs under a real `gtkx dev` server in a second headless
 * `sway` compositor — each save triggers an authentic Vite Fast Refresh that
 * repaints the running app. Both panes are recorded with `wf-recorder`, then
 * composed with ffmpeg side by side over the site's ink background, closed with
 * the brand end card, and encoded to `public/media/hero-demo.webm`,
 * `hero-demo.mp4`, a poster frame, and the repo-root `demo.gif` the README embeds.
 *
 * Local-only step: needs ffmpeg, sway, and wf-recorder, and the workspace built
 * (`pnpm build`). Run `node screenshots/og.ts` first to produce the end card.
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { startHeadlessCompositor, startOutputRecorder } from "./headless.js";

const SCREENSHOTS_DIR = import.meta.dirname;
const WEBSITE_DIR = resolve(SCREENSHOTS_DIR, "..");
const REPO_ROOT = resolve(WEBSITE_DIR, "..");
const OUT_DIR = join(SCREENSHOTS_DIR, "out");
const MEDIA_DIR = join(WEBSITE_DIR, "public/media");

const RECORD_SECONDS = 16;
const NOTES_SCREEN = { width: 900, height: 620 };
const CANVAS = { width: 1792, height: 960 };
const END_CARD_SECONDS = 2.5;

const sleep = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const terminate = async (child: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
    child.kill(signal);
    await Promise.race([exited, sleep(4000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
};

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(MEDIA_DIR, { recursive: true });

const endCard = join(OUT_DIR, "hero-end-card.png");
if (!existsSync(endCard)) {
    throw new Error("Missing screenshots/out/hero-end-card.png — run `node screenshots/og.ts` first");
}

console.log("Starting the Notes app under gtkx dev…");
const notes = await startHeadlessCompositor(NOTES_SCREEN.width, NOTES_SCREEN.height);
const devServer = spawn("dbus-run-session", ["--", "pnpm", "exec", "gtkx", "dev"], {
    cwd: join(REPO_ROOT, "examples/tutorial"),
    stdio: ["ignore", "inherit", "inherit"],
    env: {
        ...notes.env,
        GDK_DISABLE: "vulkan",
        GSK_RENDERER: "cairo",
        LIBGL_ALWAYS_SOFTWARE: "1",
        GSETTINGS_BACKEND: "memory",
        ADW_DEBUG_COLOR_SCHEME: "prefer-dark",
    },
});

let notesRecorder: ChildProcess | null = null;
let editorStage: ChildProcess | null = null;

try {
    await sleep(12_000);
    if (devServer.exitCode !== null) {
        throw new Error(`gtkx dev exited with code ${devServer.exitCode} before the recording`);
    }

    console.log("Recording both panes…");
    notesRecorder = startOutputRecorder(join(OUT_DIR, "hero-notes.mkv"), notes.env);

    editorStage = spawn("pnpm", ["exec", "vitest", "run", "--config", "screenshots/vitest.hero.config.ts"], {
        cwd: WEBSITE_DIR,
        stdio: ["ignore", "inherit", "inherit"],
        env: { ...process.env, GTKX_COMPOSITOR: "sway", GTKX_HEADLESS_SIZE: "800x900" },
    });

    const stageExit = await new Promise<number | null>((resolveExit) =>
        editorStage?.once("exit", (code) => resolveExit(code)),
    );
    if (stageExit !== 0) throw new Error(`The editor stage exited with code ${stageExit}`);
    notesRecorder.kill("SIGINT");
    await new Promise<void>((resolveExit) => {
        if (notesRecorder?.exitCode !== null) return resolveExit();
        notesRecorder?.once("exit", () => resolveExit());
    });
} finally {
    if (notesRecorder) await terminate(notesRecorder, "SIGINT");
    if (editorStage) await terminate(editorStage);
    await terminate(devServer);
    notes.dispose();
}

console.log("Composing and encoding…");
const editorX = 32;
const editorY = Math.round((CANVAS.height - 900) / 2);
const notesX = 832 + 28;
const notesY = Math.round((CANVAS.height - NOTES_SCREEN.height) / 2);

const compose = [
    "-y",
    "-loglevel",
    "error",
    "-i",
    join(OUT_DIR, "hero-editor.mkv"),
    "-i",
    join(OUT_DIR, "hero-notes.mkv"),
    "-loop",
    "1",
    "-t",
    String(END_CARD_SECONDS),
    "-framerate",
    "30",
    "-i",
    endCard,
    "-filter_complex",
    [
        `color=c=0x15161b:s=${CANVAS.width}x${CANVAS.height}:r=30:d=${RECORD_SECONDS}[bg]`,
        `[bg][0:v]overlay=${editorX}:${editorY}[withEditor]`,
        `[withEditor][1:v]overlay=${notesX}:${notesY}[scene]`,
        `[2:v]scale=${CANVAS.width}:${CANVAS.height},setsar=1[card]`,
        `[scene][card]concat=n=2:v=1:a=0[out]`,
    ].join(";"),
    "-map",
    "[out]",
    "-c:v",
    "libx264rgb",
    "-qp",
    "0",
    join(OUT_DIR, "hero-master.mkv"),
];
execFileSync("ffmpeg", compose, { stdio: ["ignore", "inherit", "inherit"] });

execFileSync(
    "ffmpeg",
    [
        "-y",
        "-loglevel",
        "error",
        "-i",
        join(OUT_DIR, "hero-master.mkv"),
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "38",
        "-b:v",
        "0",
        "-an",
        join(MEDIA_DIR, "hero-demo.webm"),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
);
execFileSync(
    "ffmpeg",
    [
        "-y",
        "-loglevel",
        "error",
        "-i",
        join(OUT_DIR, "hero-master.mkv"),
        "-c:v",
        "libx264",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        join(MEDIA_DIR, "hero-demo.mp4"),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
);
execFileSync(
    "ffmpeg",
    [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        "9",
        "-i",
        join(OUT_DIR, "hero-master.mkv"),
        "-frames:v",
        "1",
        join(OUT_DIR, "hero-demo-poster.png"),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
);
execFileSync(
    "ffmpeg",
    [
        "-y",
        "-loglevel",
        "error",
        "-i",
        join(OUT_DIR, "hero-master.mkv"),
        "-vf",
        "fps=12,scale=1280:-1:flags=lanczos,palettegen",
        join(OUT_DIR, "palette.png"),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
);
execFileSync(
    "ffmpeg",
    [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        "2.5",
        "-t",
        "12",
        "-i",
        join(OUT_DIR, "hero-master.mkv"),
        "-i",
        join(OUT_DIR, "palette.png"),
        "-lavfi",
        "fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4",
        join(REPO_ROOT, "demo.gif"),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
);

const sharp = (await import("sharp")).default;
const poster = await sharp(join(OUT_DIR, "hero-demo-poster.png")).webp({ quality: 88 }).toBuffer();
const { writeFileSync } = await import("node:fs");
writeFileSync(join(MEDIA_DIR, "hero-demo-poster.webp"), poster);

console.log("hero-demo.webm, hero-demo.mp4, hero-demo-poster.webp, demo.gif written.");
