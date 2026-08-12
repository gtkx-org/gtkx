import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";
import { createDevServerConfig } from "../../src/dev/vite-dev-server.js";

const BURST_WRITES = 20;
const BURST_INTERVAL_MS = 10;
const QUIET_PERIOD_MS = 400;
const WATCH_TEST_TIMEOUT_MS = 30_000;
const LIFECYCLE_WAIT_MS = WATCH_TEST_TIMEOUT_MS / 4;
const WATCH_EVENTS = ["add", "change", "unlink"] as const;
const THEME_SOURCE = "export const marker = 'dark';\n";
const IMPORTING_APP = "import { marker as theme } from './theme.js';\nexport const marker = theme;\n";

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

const watchProbe = async (probe: (server: ViteDevServer, root: string) => Promise<void>): Promise<void> => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-dev-watch-"));
    writeFileSync(join(root, "app.tsx"), marker(0));
    const server = await createServer({ ...createDevServerConfig(root, []), logLevel: "silent" });

    try {
        await waitUntil(() => isWatching(server, "app.tsx"), WATCH_TEST_TIMEOUT_MS / 3);
        await probe(server, root);
    } finally {
        await server.close();
        rmSync(root, { recursive: true, force: true });
    }
};

const reportedRevisions = async (): Promise<string[]> => {
    const reported: string[] = [];

    await watchProbe(async (server, root) => {
        server.watcher.on("change", (changed) => {
            reported.push(readFileSync(changed, "utf8"));
        });

        await burstWrites(join(root, "app.tsx"));
        await waitUntil(() => reported.length > 0, WATCH_TEST_TIMEOUT_MS / 3);
        await delay(QUIET_PERIOD_MS);
    });

    return reported;
};

const collectEvents = (server: ViteDevServer): string[] => {
    const events: string[] = [];

    for (const event of WATCH_EVENTS) {
        server.watcher.on(event, (path: string) => {
            events.push(`${event} ${basename(path)}`);
        });
    }

    return events;
};

const invalidateWithImporters = (server: ViteDevServer, id: string): void => {
    const module = server.moduleGraph.getModuleById(id);

    if (!module) {
        return;
    }

    server.moduleGraph.invalidateModule(module);

    for (const importer of module.importers) {
        server.moduleGraph.invalidateModule(importer);
    }
};

const reloadModule = async (server: ViteDevServer, id: string): Promise<string> => {
    invalidateWithImporters(server, id);

    try {
        const loaded: Record<string, unknown> = await server.ssrLoadModule(id);

        return String(loaded.marker);
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
};

const reloadsAcrossMissingImport = async (): Promise<string[]> => {
    const reloads: string[] = [];

    await watchProbe(async (server, root) => {
        const app = join(root, "app.tsx");
        const events = collectEvents(server);
        reloads.push(await reloadModule(server, app));
        writeFileSync(app, IMPORTING_APP);
        await waitUntil(() => events.includes("change app.tsx"), LIFECYCLE_WAIT_MS);
        reloads.push(await reloadModule(server, app));
        writeFileSync(join(root, "theme.ts"), THEME_SOURCE);
        await waitUntil(() => events.includes("add theme.ts"), LIFECYCLE_WAIT_MS);
        reloads.push(await reloadModule(server, app));
    });

    return reloads;
};

const removedModuleReport = async (): Promise<{ events: string[]; isStillKnown: boolean }> => {
    const report = { events: [] as string[], isStillKnown: false };

    await watchProbe(async (server, root) => {
        const dependency = join(root, "theme.ts");
        report.events = collectEvents(server);
        writeFileSync(dependency, THEME_SOURCE);
        await waitUntil(() => report.events.includes("add theme.ts"), LIFECYCLE_WAIT_MS);
        await server.ssrLoadModule(dependency);
        rmSync(dependency);
        await waitUntil(() => report.events.includes("unlink theme.ts"), LIFECYCLE_WAIT_MS);
        report.isStillKnown = Boolean(server.moduleGraph.getModuleById(dependency));
    });

    return report;
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

describe("createDevServerConfig (the watcher it configures)", () => {
    it(
        "reports a file created after startup and loads the import that was missing until it appeared",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            expect(await reloadsAcrossMissingImport()).toEqual([
                "0",
                expect.stringContaining("Does the file exist?"),
                "dark",
            ]);
        },
    );

    it(
        "reports a deleted file while its module is still on the graph, so the runner can act on it",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            const report = await removedModuleReport();
            expect(report.events).toEqual(["add theme.ts", "unlink theme.ts"]);
            expect(report.isStillKnown).toBe(true);
        },
    );
});
