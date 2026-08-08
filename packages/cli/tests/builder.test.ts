import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { build } from "../src/builder.js";

type ViteConfigSnapshot = {
    plugins: ({ name?: string } | null)[];
    build: {
        ssr: string;
        outDir: string;
        minify: boolean;
        cssMinify: boolean;
        assetsInlineLimit: number;
        ssrEmitAssets: boolean;
        rolldownOptions: { output: { entryFileNames: string } };
    };
    define: Record<string, string>;
    ssr: { noExternal: boolean };
};

const APP_VERSION_DEFINE = "__APP_VERSION__";

const { viteBuildMock } = vi.hoisted(() => ({
    viteBuildMock: vi.fn<(config: ViteConfigSnapshot) => Promise<void>>(() => Promise.resolve()),
}));

function getViteConfig(): ViteConfigSnapshot {
    const call = viteBuildMock.mock.calls[0];

    if (!call) {
        throw new Error("vite.build was not invoked");
    }

    return call[0];
}

const resetBuildMocks = (): void => {
    viteBuildMock.mockClear();
};

const restoreSpies = (): void => {
    vi.restoreAllMocks();
};

vi.mock("vite", async (importActual) => {
    const actual = await importActual<typeof import("vite")>();

    return { ...actual, build: viteBuildMock };
});

describe("build (core config)", () => {
    beforeEach(resetBuildMocks);
    afterEach(restoreSpies);

    it("invokes vite with the entry as the SSR target and bundle.js as the entry filename", async () => {
        await build({ entry: "src/index.tsx" });
        const config = getViteConfig();
        expect(config.build.ssr).toBe("src/index.tsx");
        expect(config.build.rolldownOptions.output.entryFileNames).toBe("bundle.js");
        expect(config.build.outDir).toBe("dist");
        expect(config.build.minify).toBe(true);
        expect(config.build.cssMinify).toBe(false);
        expect(config.build.assetsInlineLimit).toBe(0);
        expect(config.build.ssrEmitAssets).toBe(true);
        expect(config.ssr.noExternal).toBe(true);
        expect(config.define["process.env.NODE_ENV"]).toBe(JSON.stringify("production"));
    });

    it("respects a custom outDir from user vite config", async () => {
        await build({ entry: "src/index.tsx", vite: { build: { outDir: "build" } } });
        expect(getViteConfig().build.outDir).toBe("build");
    });

    it("lets a user-supplied minify override the default without clobbering", async () => {
        await build({ entry: "src/index.tsx", vite: { build: { minify: false } } });
        expect(getViteConfig().build.minify).toBe(false);
    });

    it("forces ssr.noExternal=true regardless of user ssr config", async () => {
        await build({ entry: "src/index.tsx", vite: { ssr: { noExternal: ["other-pkg"] } } });
        expect(getViteConfig().ssr.noExternal).toBe(true);
    });
});

describe("build (plugin order)", () => {
    beforeEach(resetBuildMocks);
    afterEach(restoreSpies);

    it("registers all gtkx vite plugins in order", async () => {
        await build({ entry: "src/index.tsx" });
        const pluginNames = getViteConfig().plugins.map((p) => p?.name);

        expect(pluginNames).toEqual([
            "gtkx:config",
            "gtkx:undeclared-library",
            "gtkx:settings",
            "gtkx:icons",
            "gtkx:resources",
            "gtkx:css",
            "gtkx:react-compiler",
            "gtkx:worker",
            "gtkx:built-url",
            "gtkx:native",
        ]);
    });

    it("appends gtkx plugins after user-supplied plugins", async () => {
        const userPlugin = { name: "user-plugin" };
        await build({ entry: "src/index.tsx", vite: { plugins: [userPlugin] } });
        const pluginNames = getViteConfig().plugins.map((p) => p?.name);
        expect(pluginNames[0]).toBe("user-plugin");

        expect(pluginNames.slice(1)).toEqual([
            "gtkx:config",
            "gtkx:undeclared-library",
            "gtkx:settings",
            "gtkx:icons",
            "gtkx:resources",
            "gtkx:css",
            "gtkx:react-compiler",
            "gtkx:worker",
            "gtkx:built-url",
            "gtkx:native",
        ]);
    });
});

describe("build (root resolution)", () => {
    beforeEach(resetBuildMocks);
    afterEach(restoreSpies);

    it("falls back to process.cwd() for the gtkx-native plugin when no vite root is given", async () => {
        const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/fake/project");
        await build({ entry: "src/index.tsx" });
        expect(cwdSpy).toHaveBeenCalled();
        const nativePlugin = getViteConfig().plugins.find((p) => p?.name === "gtkx:native");
        expect(nativePlugin).toBeDefined();
        cwdSpy.mockRestore();
    });

    it("uses the user-supplied vite root and does not call process.cwd()", async () => {
        const cwdSpy = vi.spyOn(process, "cwd");
        await build({ entry: "src/index.tsx", vite: { root: "/explicit/root" } });
        expect(cwdSpy).not.toHaveBeenCalled();
        cwdSpy.mockRestore();
    });

    it("forwards a custom assetBase to the gtkx-built-url plugin", async () => {
        await build({ entry: "src/index.tsx", assetBase: "../share/app" });
        const builtUrlPlugin = getViteConfig().plugins.find((p) => p?.name === "gtkx:built-url");
        expect(builtUrlPlugin).toBeDefined();
    });
});

describe("build (define and rolldown)", () => {
    beforeEach(resetBuildMocks);
    afterEach(restoreSpies);

    it("merges user-supplied define entries while forcing NODE_ENV to production", async () => {
        await build({
            entry: "src/index.tsx",
            vite: { define: { [APP_VERSION_DEFINE]: JSON.stringify("1.2.3") } },
        });

        const config = getViteConfig();
        expect(config.define[APP_VERSION_DEFINE]).toBe(JSON.stringify("1.2.3"));
        expect(config.define["process.env.NODE_ENV"]).toBe(JSON.stringify("production"));
    });

    it("preserves user rolldown output options while overriding entryFileNames", async () => {
        const userOutput = { format: "es" as const, sourcemap: true };

        await build({
            entry: "src/index.tsx",
            vite: { build: { rolldownOptions: { output: userOutput } } },
        });

        const output = getViteConfig().build.rolldownOptions.output as Record<string, unknown>;
        expect(output.format).toBe("es");
        expect(output.sourcemap).toBe(true);
        expect(output.entryFileNames).toBe("bundle.js");
    });
});
