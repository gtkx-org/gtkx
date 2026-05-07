import { describe, expect, it } from "vitest";
import { gtkxBuiltUrl } from "../src/vite-plugin-gtkx-built-url.js";

type ConfigHook = (userConfig: {
    experimental?: {
        renderBuiltUrl?: unknown;
    };
}) =>
    | undefined
    | {
          experimental: {
              renderBuiltUrl: (filename: string, ctx: { type: string }) => unknown;
          };
      };

const callConfig = (plugin: ReturnType<typeof gtkxBuiltUrl>, userConfig: Parameters<ConfigHook>[0]) =>
    (plugin.config as ConfigHook)(userConfig);

describe("gtkxBuiltUrl", () => {
    it("returns a plugin with the expected name", () => {
        const plugin = gtkxBuiltUrl();
        expect(plugin.name).toBe("gtkx:built-url");
    });

    it("config returns undefined when the user already configures renderBuiltUrl", () => {
        const plugin = gtkxBuiltUrl();
        const result = callConfig(plugin, { experimental: { renderBuiltUrl: () => undefined } });
        expect(result).toBeUndefined();
    });

    it("config installs renderBuiltUrl when no user config is present", () => {
        const plugin = gtkxBuiltUrl();
        const result = callConfig(plugin, {});
        expect(typeof result?.experimental.renderBuiltUrl).toBe("function");
    });

    it("renderBuiltUrl returns undefined for non-asset types", () => {
        const result = callConfig(gtkxBuiltUrl(), {});
        const out = result?.experimental.renderBuiltUrl("logo.png", { type: "public" });
        expect(out).toBeUndefined();
    });

    it("renderBuiltUrl with assetBase resolves relative to process.execPath", () => {
        const result = callConfig(gtkxBuiltUrl("../share/gtkx"), {});
        const out = result?.experimental.renderBuiltUrl("logo.png", { type: "asset" }) as { runtime: string };
        expect(out.runtime).toContain('require("path").join');
        expect(out.runtime).toContain("process.execPath");
        expect(out.runtime).toContain('"../share/gtkx"');
        expect(out.runtime).toContain('"logo.png"');
    });

    it("renderBuiltUrl without assetBase uses import.meta.url", () => {
        const result = callConfig(gtkxBuiltUrl(), {});
        const out = result?.experimental.renderBuiltUrl("logo.png", { type: "asset" }) as { runtime: string };
        expect(out.runtime).toBe('new URL("./logo.png", import.meta.url).pathname');
    });
});
