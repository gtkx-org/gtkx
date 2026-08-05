import { describe, expect, it, vi } from "vitest";
import { gtkxBuiltUrl } from "../../src/vite-plugins/built-url.js";

type ConfigHook = (userConfig: {
    experimental?: {
        renderBuiltUrl?: unknown;
    };
}) =>
    | undefined |
    {
        experimental: {
            renderBuiltUrl: (filename: string, ctx: { type: string }) => unknown;
        };
    };

const callConfig = (plugin: ReturnType<typeof gtkxBuiltUrl>, userConfig: Parameters<ConfigHook>[0]) =>
    (plugin.config as ConfigHook)(userConfig);

const renderAssetUrl = (assetBase?: string): { runtime: string } => {
    const result = callConfig(gtkxBuiltUrl(assetBase), {});

    return result?.experimental.renderBuiltUrl("logo.png", { type: "asset" }) as { runtime: string };
};

describe("gtkxBuiltUrl", () => {
    it("returns a plugin with the expected name", () => {
        const plugin = gtkxBuiltUrl();
        expect(plugin.name).toBe("gtkx:built-url");
    });

    it("config returns undefined when the user already configures renderBuiltUrl", () => {
        const plugin = gtkxBuiltUrl();
        const result = callConfig(plugin, { experimental: { renderBuiltUrl: vi.fn() } });
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
        expect(renderAssetUrl("../share/gtkx").runtime).toBe(
            'decodeURIComponent(new URL("../share/gtkx/logo.png", `file://${process.execPath}`).pathname)',
        );
    });

    it("renderBuiltUrl keeps an absolute assetBase under the executable's directory", () => {
        expect(renderAssetUrl("/resources").runtime).toBe(
            'decodeURIComponent(new URL("./resources/logo.png", `file://${process.execPath}`).pathname)',
        );
    });

    it("renderBuiltUrl never emits require, which an ESM bundle cannot evaluate", () => {
        for (const assetBase of ["../share/gtkx", undefined]) {
            expect(renderAssetUrl(assetBase).runtime).not.toContain("require(");
        }
    });

    it("renderBuiltUrl without assetBase uses import.meta.url", () => {
        expect(renderAssetUrl().runtime).toBe('decodeURIComponent(new URL("./logo.png", import.meta.url).pathname)');
    });
});
