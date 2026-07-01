import type { HookHandler, Plugin } from "vite";
import { describe, expect, it, vi } from "vitest";
import { resolveGtkxConfig } from "../src/config.js";
import type { GtkxConfigLoader } from "../src/index.js";
import { createGtkxConfigPlugin } from "../src/plugin.js";
import { GTKX_CONFIG_VIRTUAL_ID, RESOLVED_GTKX_CONFIG_VIRTUAL_ID } from "../src/virtual.js";

const hookHandlerOf = <K extends keyof Plugin>(
    plugin: Plugin,
    name: K,
): OmitThisParameter<NonNullable<HookHandler<Plugin[K]>>> => {
    const hook = plugin[name];
    if (hook === undefined || hook === null) throw new Error(`expected the plugin to define the ${String(name)} hook`);
    if (typeof hook === "object" && "handler" in hook) return hook.handler;
    return hook;
};

const makeLoader = (): GtkxConfigLoader => vi.fn(async () => resolveGtkxConfig({}));

const resolveId = (plugin: Plugin, id: string): string | undefined => {
    const result = hookHandlerOf(plugin, "resolveId")(id, undefined, { isEntry: false });
    return typeof result === "string" ? result : undefined;
};

const load = async (plugin: Plugin, id: string): Promise<string | undefined> => {
    const result = await hookHandlerOf(plugin, "load")(id);
    return typeof result === "string" ? result : undefined;
};

const applyConfig = (plugin: Plugin, root: string): void => {
    hookHandlerOf(plugin, "config")({ root }, { command: "serve", mode: "development" });
};

describe("createGtkxConfigPlugin", () => {
    it("resolves the public virtual id to the internal resolved id", () => {
        const plugin = createGtkxConfigPlugin({ name: "gtkx-config", loadConfig: makeLoader() });
        expect(resolveId(plugin, GTKX_CONFIG_VIRTUAL_ID)).toBe(RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
    });

    it("leaves unrelated ids unresolved", () => {
        const plugin = createGtkxConfigPlugin({ name: "gtkx-config", loadConfig: makeLoader() });
        expect(resolveId(plugin, "x")).toBeUndefined();
    });

    it("ignores load requests for unrelated ids", async () => {
        const plugin = createGtkxConfigPlugin({ name: "gtkx-config", loadConfig: makeLoader() });
        expect(await load(plugin, "x")).toBeUndefined();
    });

    it("loads the config from process.cwd() when no config hook has run", async () => {
        const loadConfig = makeLoader();
        const plugin = createGtkxConfigPlugin({ name: "gtkx-config", loadConfig });
        await load(plugin, RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
        expect(loadConfig).toHaveBeenCalledWith(process.cwd());
    });

    it("loads the config from the root captured by the config hook", async () => {
        const loadConfig = makeLoader();
        const plugin = createGtkxConfigPlugin({ name: "gtkx-config", loadConfig });
        applyConfig(plugin, "/some/root");
        await load(plugin, RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
        expect(loadConfig).toHaveBeenCalledWith("/some/root");
    });

    it("renders the resolved config exports for the virtual module", async () => {
        const loadConfig: GtkxConfigLoader = async () => resolveGtkxConfig({ applicationId: "org.gtk.Demo4" });
        const plugin = createGtkxConfigPlugin({ name: "gtkx-config", loadConfig });
        const source = await load(plugin, RESOLVED_GTKX_CONFIG_VIRTUAL_ID);
        expect(source).toContain('export * from "@gtkx/jsx/metadata";');
        expect(source).toContain('export const applicationId = "org.gtk.Demo4";');
    });
});
