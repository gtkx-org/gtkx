import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";
import { missingImportName } from "../../src/dev/missing-import.js";
import { createDevServerConfig, type DevServerConfig, isServerConfigFile } from "../../src/dev/vite-dev-server.js";

const BURST_WRITES = 20;
const BURST_INTERVAL_MS = 10;
const QUIET_PERIOD_MS = 400;
const WATCH_TEST_TIMEOUT_MS = 30_000;
const LIFECYCLE_WAIT_MS = WATCH_TEST_TIMEOUT_MS / 4;
const WATCH_EVENTS = ["add", "change", "unlink"] as const;
const THEME_SOURCE = "export const marker = 'dark';\n";
const IMPORTING_APP = "import { marker as theme } from './theme.js';\nexport const marker = theme;\n";
const VITE_CONFIG_SOURCE = "export default { clearScreen: false };\n";
const ENV_SOURCE = "VITE_PROBE=1\n";

const RESOLVED_CONFIG: DevServerConfig = {
    configFile: "/proj/vite.config.ts",
    configFileDependencies: ["/proj/vite.shared.ts"],
    envDir: "/proj",
    mode: "development",
};

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

const watchProbe = async (
    probe: (server: ViteDevServer, root: string) => Promise<void>,
    seed: (root: string) => void = (): void => undefined,
): Promise<void> => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-dev-watch-"));
    writeFileSync(join(root, "app.tsx"), marker(0));
    seed(root);
    const server = await createServer({ ...createDevServerConfig(root, []), logLevel: "silent" });

    try {
        await waitUntil(() => isWatching(server, "app.tsx"), WATCH_TEST_TIMEOUT_MS / 2);
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
        await waitUntil(() => reported.length > 0, WATCH_TEST_TIMEOUT_MS / 2);
        await delay(QUIET_PERIOD_MS);
    });

    return reported;
};

const collectEvents = (server: ViteDevServer): string[] => {
    const events: string[] = [];

    for (const event of WATCH_EVENTS) {
        server.watcher.on(event, (watched: string) => {
            events.push(`${event} ${watched}`);
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
        const theme = join(root, "theme.ts");
        const events = collectEvents(server);
        reloads.push(await reloadModule(server, app));
        writeFileSync(app, IMPORTING_APP);
        await waitUntil(() => events.includes(`change ${app}`), LIFECYCLE_WAIT_MS);
        reloads.push(await reloadModule(server, app));
        writeFileSync(theme, THEME_SOURCE);
        await waitUntil(() => events.includes(`add ${theme}`), LIFECYCLE_WAIT_MS);
        reloads.push(await reloadModule(server, app));
    });

    return reloads;
};

const selfRestartReport = async (
    name: string,
    source: string,
    seed: (root: string) => void = (): void => undefined,
): Promise<{ isFlagged: boolean; isWatcherReplaced: boolean }> => {
    const report = { isFlagged: false, isWatcherReplaced: false };

    await watchProbe(async (server, root) => {
        const file = join(root, name);
        const watcher = server.watcher;
        writeFileSync(file, source);
        await waitUntil(() => server.watcher !== watcher, LIFECYCLE_WAIT_MS);
        report.isWatcherReplaced = server.watcher !== watcher;
        report.isFlagged = isServerConfigFile(server.config, file);
    }, seed);

    return report;
};

const removedModuleReport = async (): Promise<{ events: string[]; removed: string; isStillKnown: boolean }> => {
    const report = { events: [] as string[], removed: "", isStillKnown: false };

    await watchProbe(async (server, root) => {
        const theme = join(root, "theme.ts");
        report.events = collectEvents(server);
        report.removed = theme;
        writeFileSync(theme, THEME_SOURCE);
        await waitUntil(() => report.events.includes(`add ${theme}`), LIFECYCLE_WAIT_MS);
        await server.ssrLoadModule(theme);
        rmSync(theme);
        await waitUntil(() => report.events.includes(`unlink ${theme}`), LIFECYCLE_WAIT_MS);
        report.isStillKnown = Boolean(server.moduleGraph.getModuleById(theme));
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

describe("isServerConfigFile", () => {
    it("names the config file and the files it depends on", () => {
        expect(isServerConfigFile(RESOLVED_CONFIG, "/proj/vite.config.ts")).toBe(true);
        expect(isServerConfigFile(RESOLVED_CONFIG, "/proj/vite.shared.ts")).toBe(true);
    });

    it("names every env file vite reads for the running mode", () => {
        for (const name of [".env", ".env.local", ".env.development", ".env.development.local"]) {
            expect(isServerConfigFile(RESOLVED_CONFIG, `/proj/${name}`), `${name} restarts the server`).toBe(true);
        }
    });

    it("leaves source files and the env files of other modes to the module pipeline", () => {
        expect(isServerConfigFile(RESOLVED_CONFIG, "/proj/src/app.tsx")).toBe(false);
        expect(isServerConfigFile(RESOLVED_CONFIG, "/proj/.env.production")).toBe(false);
    });

    it("names no env file when the project turned the env directory off", () => {
        expect(isServerConfigFile({ ...RESOLVED_CONFIG, envDir: false }, "/proj/.env")).toBe(false);
    });
});

describe("createDevServerConfig (the restarts vite runs on its own)", () => {
    it(
        "hands the runner an env change it must act on before vite replaces the watcher underneath it",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            expect(await selfRestartReport(".env", ENV_SOURCE)).toEqual({
                isFlagged: true,
                isWatcherReplaced: true,
            });
        },
    );

    it(
        "hands the runner a vite config change it must act on before vite replaces the watcher underneath it",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            const report = await selfRestartReport("vite.config.ts", `${VITE_CONFIG_SOURCE}\n`, (root) => {
                writeFileSync(join(root, "vite.config.ts"), VITE_CONFIG_SOURCE);
            });

            expect(report).toEqual({ isFlagged: true, isWatcherReplaced: true });
        },
    );
});

describe("createDevServerConfig (the watcher it configures)", () => {
    it(
        "reports a file created after startup and loads the import that was missing until it appeared",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            const reloads = await reloadsAcrossMissingImport();
            expect(reloads).toEqual(["0", expect.stringContaining("Does the file exist?"), "dark"]);
            expect(missingImportName(reloads[1])).toBe("theme");
        },
    );

    it(
        "reports a deleted file while its module is still on the graph, so the runner can act on it",
        { timeout: WATCH_TEST_TIMEOUT_MS },
        async () => {
            const report = await removedModuleReport();
            expect(report.events).toEqual([`add ${report.removed}`, `unlink ${report.removed}`]);
            expect(report.isStillKnown).toBe(true);
        },
    );
});
