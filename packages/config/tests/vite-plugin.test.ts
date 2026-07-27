import type { Plugin } from "vite";
import { describe, expect, it, vi } from "vitest";
import type { ConfigLoader } from "../src/internal.js";
import { resolveConfig } from "../src/config.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID } from "../src/virtual.js";
import createConfigPlugin from "../src/vite-plugin.js";

type ResolveIdHook = (id: string, importer: string | undefined, options: { isEntry: boolean }) => unknown;
type LoadHook = (id: string) => unknown;
type ConfigHook = (config: { root: string }, env: { command: "serve"; mode: string }) => unknown;

const getHookHandler = <T>(hook: T | { handler: T } | undefined | null, name: string): T => {
    if (hook === undefined || hook === null) {
        throw new Error(`expected the plugin to define the ${name} hook`);
    }

    if (typeof hook === "object" && "handler" in hook) {
        return hook.handler;
    }

    return hook;
};

const makeLoader = (): ConfigLoader => vi.fn(() => Promise.resolve(resolveConfig({ applicationId: "org.gtk.Test" })));

const resolveId = (plugin: Plugin, id: string): string | undefined => {
    const hook = getHookHandler<ResolveIdHook>(plugin.resolveId, "resolveId");
    const result = hook(id, undefined, { isEntry: false });

    return typeof result === "string" ? result : undefined;
};

const load = async (plugin: Plugin, id: string): Promise<string | undefined> => {
    const hook = getHookHandler<LoadHook>(plugin.load, "load");
    const result = await hook(id);

    return typeof result === "string" ? result : undefined;
};

const applyConfig = async (plugin: Plugin, root: string): Promise<void> => {
    const hook = getHookHandler<ConfigHook>(plugin.config, "config");
    await hook({ root }, { command: "serve", mode: "development" });
};

const loadConfig: ConfigLoader = () => Promise.resolve(resolveConfig({ applicationId: "org.gtk.Demo4" }));

describe("createConfigPlugin", () => {
    it("resolves the public virtual id to the internal resolved id", () => {
        const plugin = createConfigPlugin({ name: "gtkx-config", loadConfig: makeLoader() });
        expect(resolveId(plugin, GTKX_CONFIG_VIRTUAL_ID)).toBe(RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
    });

    it("leaves unrelated ids unresolved", () => {
        const plugin = createConfigPlugin({ name: "gtkx-config", loadConfig: makeLoader() });
        expect(resolveId(plugin, "x")).toBeUndefined();
    });

    it("ignores load requests for unrelated ids", async () => {
        const plugin = createConfigPlugin({ name: "gtkx-config", loadConfig: makeLoader() });
        expect(await load(plugin, "x")).toBeUndefined();
    });

    it("loads the config from process.cwd() when no config hook has run", async () => {
        const loadConfig = makeLoader();
        const plugin = createConfigPlugin({ name: "gtkx-config", loadConfig });
        await load(plugin, RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
        expect(loadConfig).toHaveBeenCalledWith(process.cwd());
    });

    it("loads the config from the root captured by the config hook", async () => {
        const loadConfig = makeLoader();
        const plugin = createConfigPlugin({ name: "gtkx-config", loadConfig });
        await applyConfig(plugin, "/some/root");
        await load(plugin, RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
        expect(loadConfig).toHaveBeenCalledWith("/some/root");
    });

    it("renders the resolved config exports for the virtual module", async () => {
        const plugin = createConfigPlugin({ name: "gtkx-config", loadConfig });
        const source = await load(plugin, RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
        expect(source).toContain('export * from "@gtkx/jsx/metadata";');
        expect(source).toContain('export const applicationId = "org.gtk.Demo4";');
    });
});
