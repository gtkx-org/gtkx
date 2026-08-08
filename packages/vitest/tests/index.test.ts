import type { Plugin } from "vitest/config";
import { describe, expect, it } from "vitest";
import gtkx from "../src/index.js";

type InputConfig = { root?: string };

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
    if (hook === undefined) {
        throw new Error("plugin hook is missing");
    }

    return typeof hook === "function" ? hook : hook.handler;
};

const callConfig = (plugin: Plugin, config: InputConfig): WorkerConfig =>
    unwrap(plugin.config as ConfigHook | { handler: ConfigHook } | undefined)(config);

const preloadSpecifier = (config: WorkerConfig): URL => {
    const execArgv = config.test?.execArgv ?? [];
    expect(execArgv[0]).toBe("--import");
    const specifier = execArgv[1] ?? "";
    expect(specifier.startsWith("file://")).toBe(true);

    return new URL(specifier);
};

describe("gtkx vitest plugin", () => {
    it("names the plugin and exposes config/resolveId/load hooks", () => {
        const plugin = gtkx();
        expect(plugin.name).toBe("gtkx:vitest");
        expect(plugin.config).toBeDefined();
        expect(plugin.resolveId).toBeDefined();
        expect(plugin.load).toBeDefined();
    });

    it("forces the forks pool, enables globals, and sets 30s testTimeout/hookTimeout", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.pool).toBe("forks");
        expect(result.test?.globals).toBe(true);
        expect(result.test?.testTimeout).toBe(30_000);
        expect(result.test?.hookTimeout).toBe(30_000);
    });

    it("inlines the gtkx source packages except the native addon", () => {
        const result = callConfig(gtkx(), {});
        const inline = result.test?.server?.deps?.inline ?? [];

        expect(inline.map((pattern) => pattern.source)).toEqual([
            String.raw`@gtkx\/(?!native)`,
            String.raw`[/\\]\.gtkx[/\\]`,
        ]);

        expect(inline.map((pattern) => pattern.flags)).toEqual(["", ""]);
    });

    it("preloads the headless display worker module ahead of all worker modules", () => {
        const specifier = preloadSpecifier(callConfig(gtkx(), {}));
        expect(specifier.pathname.endsWith("worker-preload.js")).toBe(true);
        expect([...specifier.searchParams]).toEqual([]);
    });

    it("encodes the headless options in the preload specifier query", () => {
        const specifier = preloadSpecifier(callConfig(gtkx({ size: "640x480", compositor: "sway" }), {}));
        expect(specifier.searchParams.get("size")).toBe("640x480");
        expect(specifier.searchParams.get("compositor")).toBe("sway");
    });

    it("leaves module resolution conditions untouched", () => {
        const result = callConfig(gtkx(), {});
        expect(result.ssr).toBeUndefined();
    });
});
