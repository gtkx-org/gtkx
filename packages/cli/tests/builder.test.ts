import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ViteConfigSnapshot = {
    plugins: Array<{ name?: string } | null>;
    build: {
        ssr: string;
        outDir: string;
        minify: boolean;
        cssMinify: boolean;
        assetsInlineLimit: number;
        ssrEmitAssets: boolean;
        rollupOptions: { output: { entryFileNames: string } };
    };
    define: Record<string, string>;
    ssr: { noExternal: boolean };
};

const { viteBuildMock } = vi.hoisted(() => ({
    viteBuildMock: vi.fn(async (_config: ViteConfigSnapshot) => undefined),
}));

vi.mock("vite", () => ({ build: viteBuildMock }));

import { build } from "../src/builder.js";

function getViteConfig(): ViteConfigSnapshot {
    const call = viteBuildMock.mock.calls[0];
    if (!call) throw new Error("vite.build was not invoked");
    return call[0];
}

describe("build", () => {
    beforeEach(() => {
        viteBuildMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("invokes vite with the entry as the SSR target and bundle.js as the entry filename", async () => {
        await build({ entry: "src/index.tsx" });

        const config = getViteConfig();
        expect(config.build.ssr).toBe("src/index.tsx");
        expect(config.build.rollupOptions.output.entryFileNames).toBe("bundle.js");
        expect(config.build.outDir).toBe("dist");
        expect(config.build.minify).toBe(true);
        expect(config.build.cssMinify).toBe(false);
        expect(config.build.assetsInlineLimit).toBe(0);
        expect(config.build.ssrEmitAssets).toBe(true);
        expect(config.ssr.noExternal).toBe(true);
        expect(config.define["process.env.NODE_ENV"]).toBe(JSON.stringify("production"));
    });

    it("registers all four gtkx vite plugins in order", async () => {
        await build({ entry: "src/index.tsx" });

        const pluginNames = getViteConfig().plugins.map((p) => p?.name);
        expect(pluginNames).toEqual(["gtkx:gsettings", "gtkx:assets", "gtkx:built-url", "gtkx:native"]);
    });

    it("appends gtkx plugins after user-supplied plugins", async () => {
        const userPlugin = { name: "user-plugin" };
        await build({ entry: "src/index.tsx", vite: { plugins: [userPlugin] } });

        const pluginNames = getViteConfig().plugins.map((p) => p?.name);
        expect(pluginNames[0]).toBe("user-plugin");
        expect(pluginNames.slice(1)).toEqual(["gtkx:gsettings", "gtkx:assets", "gtkx:built-url", "gtkx:native"]);
    });

    it("respects a custom outDir from user vite config", async () => {
        await build({ entry: "src/index.tsx", vite: { build: { outDir: "build" } } });
        expect(getViteConfig().build.outDir).toBe("build");
    });

    it("falls back to process.cwd() for the gtkx-native plugin when no vite root is given", async () => {
        const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/fake/project");
        await build({ entry: "src/index.tsx" });
        cwdSpy.mockRestore();
    });
});
