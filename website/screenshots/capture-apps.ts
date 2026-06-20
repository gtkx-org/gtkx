/**
 * Captures showcase screenshots of the built example apps.
 *
 * Each app's production bundle (`dist/bundle.js`, produced by `pnpm build`)
 * runs inside its own headless `sway` compositor with a private D-Bus session,
 * in both the light and the dark Adwaita color scheme (forced through
 * `ADW_DEBUG_COLOR_SCHEME`), and the compositor output is grabbed with `grim`
 * into a lossless master under `screenshots/out/showcase/`. The browser app
 * loads a deterministic local fixture page served from a loopback HTTP server.
 *
 * Run `postprocess.ts` afterwards to trim, round, and encode the masters.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import { grabOutput, startHeadlessCompositor } from "./headless.js";

const SCREENSHOTS_DIR = import.meta.dirname;
const REPO_ROOT = resolve(SCREENSHOTS_DIR, "../..");
const OUT_DIR = join(SCREENSHOTS_DIR, "out/showcase");

const SCREEN_WIDTH = 2200;
const SCREEN_HEIGHT = 1600;
const FIXTURE_PORT = 8939;
const THEMES = ["light", "dark"] as const;

interface AppTarget {
    name: string;
    appDir: string;
    args?: string[];
    env?: Record<string, string>;
    settleMs: number;
}

const APPS: AppTarget[] = [
    { name: "notes", appDir: "examples/tutorial", settleMs: 3000 },
    { name: "gtk-demo", appDir: "examples/gtk-demo", settleMs: 4000 },
    {
        name: "browser",
        appDir: "examples/browser",
        args: [`http://localhost:${FIXTURE_PORT}/`],
        env: { WEBKIT_DISABLE_COMPOSITING_MODE: "1" },
        settleMs: 8000,
    },
    { name: "hello-world", appDir: "examples/hello-world", settleMs: 3000 },
];

const sleep = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const startFixtureServer = (): Promise<Server> => {
    const page = readFileSync(join(SCREENSHOTS_DIR, "fixtures/browser-page.html"));
    const server = createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(page);
    });
    return new Promise((resolveServer, reject) => {
        server.once("error", reject);
        server.listen(FIXTURE_PORT, "127.0.0.1", () => resolveServer(server));
    });
};

const terminate = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
    child.kill("SIGTERM");
    await Promise.race([exited, sleep(3000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exited;
};

const captureApp = async (app: AppTarget, theme: (typeof THEMES)[number]): Promise<void> => {
    console.log(`Capturing ${app.name} (${theme}): booting, settling ${app.settleMs}ms…`);
    const compositor = await startHeadlessCompositor(SCREEN_WIDTH, SCREEN_HEIGHT);
    const child = spawn("dbus-run-session", ["--", "node", "dist/bundle.js", ...(app.args ?? [])], {
        cwd: join(REPO_ROOT, app.appDir),
        stdio: ["ignore", "ignore", "inherit"],
        env: {
            ...compositor.env,
            ...app.env,
            GDK_SCALE: "2",
            GDK_DISABLE: "vulkan",
            GSK_RENDERER: "cairo",
            LIBGL_ALWAYS_SOFTWARE: "1",
            GSETTINGS_BACKEND: "memory",
            ADW_DEBUG_COLOR_SCHEME: `prefer-${theme}`,
        },
    });

    try {
        await sleep(app.settleMs);
        if (child.exitCode !== null) {
            throw new Error(`${app.name} exited with code ${child.exitCode} before the capture`);
        }
        grabOutput(join(OUT_DIR, `${app.name}-${theme}.png`), compositor.env);
        console.log(`showcase/${app.name}-${theme}.png`);
    } finally {
        await terminate(child);
        compositor.dispose();
    }
};

mkdirSync(OUT_DIR, { recursive: true });
const fixtureServer = await startFixtureServer();

try {
    for (const app of APPS) {
        for (const theme of THEMES) {
            await captureApp(app, theme);
        }
    }
} finally {
    fixtureServer.close();
}
