import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Plugin } from "vitest/config";
import { gtkxBundledModulePatterns } from "../src/bundled-modules.js";
import gtkx from "../src/index.js";

type InputConfig = { root?: string; test?: { setupFiles?: string | string[] } };

type WorkerConfig = {
    test?: {
        setupFiles?: string[];
        pool?: string;
        testTimeout?: number;
        hookTimeout?: number;
        provide?: { gtkxHeadless?: { size?: string; compositor?: string } };
        server?: { deps?: { inline?: RegExp[] } };
    };
    ssr?: { resolve?: { conditions?: string[] } };
};

type ConfigHook = (config: InputConfig) => WorkerConfig;

const unwrap = <Fn extends (...args: never[]) => unknown>(hook: Fn | { handler: Fn } | undefined): Fn => {
    if (hook === undefined || hook === null) throw new Error("plugin hook is missing");
    return typeof hook === "function" ? hook : hook.handler;
};

const setupPath = join(import.meta.dirname, "..", "src", "worker-setup.js");

const callConfig = (plugin: Plugin, config: InputConfig): WorkerConfig =>
    unwrap(plugin.config as ConfigHook | { handler: ConfigHook } | undefined)(config);

describe("gtkx vitest plugin", () => {
    it("names the plugin and exposes config/resolveId/load hooks", () => {
        const plugin = gtkx();
        expect(plugin.name).toBe("gtkx:vitest");
        expect(plugin.config).toBeDefined();
        expect(plugin.resolveId).toBeDefined();
        expect(plugin.load).toBeDefined();
    });

    it("forces the forks pool and 20s timeouts", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.pool).toBe("forks");
        expect(result.test?.testTimeout).toBe(20000);
        expect(result.test?.hookTimeout).toBe(20000);
    });

    it("inlines the shared gtkx bundled-module patterns", () => {
        const result = callConfig(gtkx(), {});
        const inline = result.test?.server?.deps?.inline ?? [];
        expect(inline.map((pattern) => pattern.source)).toEqual(
            gtkxBundledModulePatterns.map((pattern) => pattern.source),
        );
        expect(inline.map((pattern) => pattern.flags)).toEqual(
            gtkxBundledModulePatterns.map((pattern) => pattern.flags),
        );
    });

    it("provides the headless options to the worker setup over the injected channel", () => {
        const result = callConfig(gtkx({ size: "640x480", compositor: "sway" }), {});
        expect(result.test?.provide?.gtkxHeadless).toEqual({ size: "640x480", compositor: "sway" });
    });

    it("leaves the injected headless options unset when none are configured", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.provide?.gtkxHeadless).toEqual({ size: undefined, compositor: undefined });
    });

    it("orders the ssr resolve conditions source-first", () => {
        const result = callConfig(gtkx(), {});
        expect(result.ssr?.resolve?.conditions).toEqual(["source", "module", "node", "development|production"]);
    });

    it("prepends the worker setup file before an existing array of setup files", () => {
        const result = callConfig(gtkx(), { test: { setupFiles: ["existing-a.ts", "existing-b.ts"] } });
        expect(result.test?.setupFiles).toEqual([setupPath, "existing-a.ts", "existing-b.ts"]);
    });

    it("wraps a single string setup file before prepending the worker setup", () => {
        const result = callConfig(gtkx(), { test: { setupFiles: "single-setup.ts" } });
        expect(result.test?.setupFiles).toEqual([setupPath, "single-setup.ts"]);
    });

    it("prepends only the worker setup when no setup files are configured", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.setupFiles).toEqual([setupPath]);
    });
});
