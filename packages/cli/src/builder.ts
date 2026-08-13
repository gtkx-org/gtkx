import { join } from "node:path";
import { type InlineConfig, mergeConfig, build as viteBuild } from "vite";
import { gtkxBuiltUrl } from "./vite-plugins/built-url.js";
import { esmExtension } from "./vite-plugins/esm-extension.js";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxNative } from "./vite-plugins/native.js";
import { gtkxSelfContained } from "./vite-plugins/self-contained.js";
import { gtkxWorker } from "./vite-plugins/worker.js";

type BuildOptions = {
    entry: string;
    assetBase?: string | undefined;
    vite?: InlineConfig | undefined;
};

const BUILD_MODE = "production";
const BUNDLE_STEM = "bundle";
const DEFAULT_OUT_DIR = "dist";

const buildDefaults: InlineConfig = {
    build: {
        ssrEmitAssets: true,
        outDir: DEFAULT_OUT_DIR,
        minify: true,
        cssMinify: false,
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(BUILD_MODE),
    },
};

const build = async (options: BuildOptions): Promise<string> => {
    const { entry, assetBase, vite: viteConfig } = options;
    const root = viteConfig?.root ?? process.cwd();
    const entryFileNames = BUNDLE_STEM + esmExtension(root);

    const forced: InlineConfig = {
        plugins: [
            ...gtkxVitePlugins(BUILD_MODE),
            gtkxWorker(root),
            gtkxBuiltUrl(assetBase),
            gtkxNative(root),
            gtkxSelfContained(),
        ],
        build: {
            ssr: entry,
            assetsInlineLimit: 0,
            rolldownOptions: {
                output: {
                    entryFileNames,
                },
            },
        },
    };

    const merged: InlineConfig = mergeConfig(mergeConfig(buildDefaults, viteConfig ?? {}), forced);
    await viteBuild({ ...merged, ssr: { ...merged.ssr, noExternal: true } });

    return join(merged.build?.outDir ?? DEFAULT_OUT_DIR, entryFileNames);
};

export { build };
