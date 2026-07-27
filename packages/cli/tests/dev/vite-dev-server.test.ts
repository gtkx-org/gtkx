import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { createDevServerConfig } from "../../src/dev/vite-dev-server.js";

const isKeptInternal = (patterns: RegExp[], id: string): boolean => patterns.some((pattern) => pattern.test(id));

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
