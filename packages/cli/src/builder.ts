import { type InlineConfig, mergeConfig, build as viteBuild } from "vite";
import { gtkxBuiltUrl } from "./vite-plugins/built-url.js";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxNative } from "./vite-plugins/native.js";

const BUILD_MODE = "production";

export type BuildOptions = {
    entry: string;
    assetBase?: string | undefined;
    vite?: InlineConfig | undefined;
};

const buildDefaults: InlineConfig = {
    build: {
        ssrEmitAssets: true,
        outDir: "dist",
        minify: true,
        cssMinify: false,
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(BUILD_MODE),
    },
};

export const build = async (options: BuildOptions): Promise<void> => {
    const { entry, assetBase, vite: viteConfig } = options;
    const root = viteConfig?.root ?? process.cwd();

    const forced: InlineConfig = {
        plugins: [...gtkxVitePlugins(BUILD_MODE), gtkxBuiltUrl(assetBase), gtkxNative(root)],
        build: {
            ssr: entry,
            assetsInlineLimit: 0,
            rolldownOptions: {
                output: {
                    entryFileNames: "bundle.js",
                },
            },
        },
    };

    const merged = mergeConfig(mergeConfig(buildDefaults, viteConfig ?? {}), forced);

    await viteBuild({ ...merged, ssr: { ...merged.ssr, noExternal: true } });
};
