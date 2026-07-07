import { describe, expect, it } from "vitest";
import type { Plugin } from "vitest/config";
import gtkx from "../src/index.js";

type InputConfig = { root?: string; test?: { setupFiles?: string | string[] } };

type WorkerConfig = {
    test?: {
        globals?: boolean;
        execArgv?: string[];
        pool?: string;
        testTimeout?: number;
        hookTimeout?: number;
        server?: { deps?: { inline?: RegExp[] } };
    };
    ssr?: { resolve?: { conditions?: string[] } };
};

type ConfigHook = (config: InputConfig) => WorkerConfig;

const unwrap = <Fn extends (...args: never[]) => unknown>(hook: Fn | { handler: Fn } | undefined): Fn => {
    if (hook === undefined || hook === null) throw new Error("plugin hook is missing");
    return typeof hook === "function" ? hook : hook.handler;
};

const callConfig = (plugin: Plugin, config: InputConfig): WorkerConfig =>
    unwrap(plugin.config as ConfigHook | { handler: ConfigHook } | undefined)(config);

const decodeBootstrapModule = (config: WorkerConfig): string => {
    const execArgv = config.test?.execArgv ?? [];
    expect(execArgv[0]).toBe("--import");
    const specifier = execArgv[1] ?? "";
    expect(specifier.startsWith("data:text/javascript,")).toBe(true);
    return decodeURIComponent(specifier.slice("data:text/javascript,".length));
};

describe("gtkx vitest plugin", () => {
    it("names the plugin and exposes config/resolveId/load hooks", () => {
        const plugin = gtkx();
        expect(plugin.name).toBe("gtkx:vitest");
        expect(plugin.config).toBeDefined();
        expect(plugin.resolveId).toBeDefined();
        expect(plugin.load).toBeDefined();
    });

    it("forces the forks pool, enables globals, and sets 20s timeouts", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.pool).toBe("forks");
        expect(result.test?.globals).toBe(true);
        expect(result.test?.testTimeout).toBe(20000);
        expect(result.test?.hookTimeout).toBe(20000);
    });

    it("inlines the gtkx source packages except the native addon", () => {
        const result = callConfig(gtkx(), {});
        const inline = result.test?.server?.deps?.inline ?? [];
        expect(inline.map((pattern) => pattern.source)).toEqual(["@gtkx\\/(?!native)", "[/\\\\]\\.gtkx[/\\\\]"]);
        expect(inline.map((pattern) => pattern.flags)).toEqual(["", ""]);
    });

    it("preloads the headless display bootstrap ahead of all worker modules", () => {
        const module = decodeBootstrapModule(callConfig(gtkx(), {}));
        expect(module).toContain("worker-preload.js");
        expect(module).toContain("await bootstrapHeadlessDisplay({})");
    });

    it("embeds the headless options in the bootstrap module", () => {
        const module = decodeBootstrapModule(callConfig(gtkx({ size: "640x480", compositor: "sway" }), {}));
        expect(module).toContain('await bootstrapHeadlessDisplay({"size":"640x480","compositor":"sway"})');
    });

    it("leaves module resolution conditions untouched", () => {
        const result = callConfig(gtkx(), {});
        expect(result.ssr).toBeUndefined();
    });
});
