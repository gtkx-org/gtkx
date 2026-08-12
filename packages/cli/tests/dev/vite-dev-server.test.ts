import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";
import { createDevServerConfig } from "../../src/dev/vite-dev-server.js";

const BURST_WRITES = 20;
const BURST_INTERVAL_MS = 10;
const QUIET_PERIOD_MS = 400;
const WATCH_TEST_TIMEOUT_MS = 30_000;

const isKeptInternal = (patterns: RegExp[], id: string): boolean => patterns.some((pattern) => pattern.test(id));
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const marker = (revision: number): string => `export const marker = ${String(revision)};\n`;

const waitUntil = async (isDone: () => boolean, timeoutMs: number): Promise<void> => {
    const deadline = Date.now() + timeoutMs;

    while (!isDone() && Date.now() < deadline) {
        await delay(BURST_INTERVAL_MS);
    }
};

const isWatching = (server: ViteDevServer, file: string): boolean =>
    Object.values(server.watcher.getWatched()).some((entries) => entries.includes(file));

const burstWrites = async (file: string): Promise<void> => {
    for (let revision = 1; revision <= BURST_WRITES; revision++) {
        writeFileSync(file, marker(revision));
        await delay(BURST_INTERVAL_MS);
    }
};

const reportedRevisions = async (): Promise<string[]> => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-dev-watch-"));
    const file = join(root, "app.tsx");
    writeFileSync(file, marker(0));
    const server = await createServer({ ...createDevServerConfig(root, []), logLevel: "silent" });
    const reported: string[] = [];

    server.watcher.on("change", (changed) => {
        reported.push(readFileSync(changed, "utf8"));
    });

    try {
        await waitUntil(() => isWatching(server, "app.tsx"), WATCH_TEST_TIMEOUT_MS / 2);
        await burstWrites(file);
        await waitUntil(() => reported.length > 0, WATCH_TEST_TIMEOUT_MS / 2);
        await delay(QUIET_PERIOD_MS);
    } finally {
        await server.close();
        rmSync(root, { recursive: true, force: true });
    }

    return reported;
};

describe("createDevServerConfig", () => {
    it("builds the SSR middleware-mode config that externalizes all deps", () => {
        const plugins: Plugin[] = [{ name: "stub" }];
        const config = createDevServerConfig("/proj", plugins);
        expect(config.root).toBe("/proj");
        expect(config.appType).toBe("custom");
        expect(config.plugins).toBe(plugins);
        expect(config.server?.middlewareMode).toBe(true);
        expect(config.ssr?.external).toBe(true);
    });

    it(
        "reports a burst of saves once, after the last write, so a pass never starts on a superseded revision",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            expect(await reportedRevisions()).toEqual([marker(BURST_WRITES)]);
        },
    );

    it("keeps every gtkx package that reaches virtual:gtkx-config internal so its imports are transformed", () => {
        const noExternal = createDevServerConfig("/proj", []).ssr?.noExternal as RegExp[];

        for (const id of [
            "@gtkx/config",
            "@gtkx/react",
            "@gtkx/jsx",
            "@gtkx/jsx/gtk",
            "@gtkx/components",
            "@gtkx/testing",
        ]) {
            expect(isKeptInternal(noExternal, id), `${id} must stay internal`).toBe(true);
        }
    });

    it("externalizes the native, generated, and singleton leaves", () => {
        const noExternal = createDevServerConfig("/proj", []).ssr?.noExternal as RegExp[];

        for (const id of [
            "@gtkx/native",
            "@gtkx/gi",
            "@gtkx/gi/gtk",
            "@gtkx/gl",
            "@gtkx/runtime",
            "@gtkx/utils",
            "@gtkx/css",
            "react",
        ]) {
            expect(isKeptInternal(noExternal, id), `${id} must be external`).toBe(false);
        }
    });
});
