import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { buildConfig } from "../../src/dev/vite-dev-server.js";

describe("buildConfig", () => {
    it("builds the SSR middleware-mode config keeping the gtkx packages bundled", () => {
        const plugins: Plugin[] = [{ name: "stub" }];
        const config = buildConfig("/proj", plugins);

        expect(config.root).toBe("/proj");
        expect(config.appType).toBe("custom");
        expect(config.plugins).toBe(plugins);
        expect(config.server?.middlewareMode).toBe(true);
        expect(config.ssr?.external).toBe(true);

        const noExternal = config.ssr?.noExternal as RegExp[];
        expect(noExternal[0]?.test("@gtkx/react")).toBe(true);
        expect(noExternal[0]?.test("@gtkx/animate")).toBe(true);
        expect(noExternal[0]?.test("react")).toBe(false);
    });
});
