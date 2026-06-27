import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Plugin } from "vitest/config";
import gtkx from "../src/index.js";

type InputConfig = { root?: string; test?: { setupFiles?: string | string[] } };

type WorkerConfig = {
    test?: {
        globals?: boolean;
        setupFiles?: string[];
        provide?: { gtkxHeadless?: { size?: string; compositor?: string } };
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

const workerSetupPath = join(import.meta.dirname, "..", "src", "worker-setup.js");

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

    it("registers the headless display setup file", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.setupFiles).toEqual([workerSetupPath]);
    });

    it("provides the headless options to the worker", () => {
        const result = callConfig(gtkx({ size: "640x480", compositor: "sway" }), {});
        expect(result.test?.provide?.gtkxHeadless).toEqual({ size: "640x480", compositor: "sway" });
    });

    it("provides empty headless options when none are configured", () => {
        const result = callConfig(gtkx(), {});
        expect(result.test?.provide?.gtkxHeadless).toEqual({});
    });

    it("orders the ssr resolve conditions source-first", () => {
        const result = callConfig(gtkx(), {});
        expect(result.ssr?.resolve?.conditions).toEqual(["source", "module", "node", "development|production"]);
    });
});
