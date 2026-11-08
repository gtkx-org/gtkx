/**
 * Renders `og.html` to `public/og.png`, the social card of every page, with a local headless Chromium
 * driven through the DevTools protocol.
 *
 * Usage: `node website/scripts/og.mjs [chromium-binary]` (defaults to `chromium-browser`).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "og.html");
const output = join(here, "..", "public", "og.png");
const browser = process.argv[2] ?? "chromium-browser";
const WIDTH = 1200;
const HEIGHT = 630;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connect = async (url) => {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });
    let nextId = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const call = pending.get(message.id);
        if (call) {
            pending.delete(message.id);
            if (message.error) call.reject(new Error(message.error.message));
            else call.resolve(message.result);
        } else if (listeners.has(message.method)) {
            listeners.get(message.method)();
            listeners.delete(message.method);
        }
    };
    const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            nextId += 1;
            pending.set(nextId, { resolve, reject });
            ws.send(JSON.stringify({ id: nextId, method, params }));
        });
    const once = (method) => new Promise((resolve) => listeners.set(method, resolve));
    return { send, once, close: () => ws.close() };
};

const waitForBrowser = async (port) => {
    for (let attempt = 0; attempt < 50; attempt++) {
        const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(
            (response) => response.json(),
            () => undefined,
        );
        if (version) return;
        await sleep(200);
    }
    throw new Error(`${browser} did not start`);
};

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "gtkx-og-"));
const chromium = spawn(
    browser,
    [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--allow-file-access-from-files",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        "about:blank",
    ],
    { stdio: "ignore" },
);

try {
    await waitForBrowser(port);
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((response) =>
        response.json(),
    );
    const page = await connect(target.webSocketDebuggerUrl);
    await page.send("Page.enable");
    await page.send("Emulation.setDeviceMetricsOverride", {
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
    });
    const loaded = page.once("Page.loadEventFired");
    await page.send("Page.navigate", { url: pathToFileURL(source).href });
    await loaded;
    await page.send("Runtime.evaluate", {
        awaitPromise: true,
        expression: `Promise.all([document.fonts.ready, ...[...document.images].map((image) => image.decode())])`,
    });
    const shot = await page.send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
    });
    writeFileSync(output, Buffer.from(shot.data, "base64"));
    page.close();
    console.log(`Wrote ${output}`);
} finally {
    chromium.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
}
