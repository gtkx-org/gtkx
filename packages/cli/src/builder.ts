import { join, posix } from "node:path";
import { type InlineConfig, mergeConfig, build as viteBuild } from "vite";
import { gtkxBuiltUrl } from "./vite-plugins/built-url.js";
import { BUNDLE_FILENAME, ESM_EXTENSION } from "./vite-plugins/esm-extension.js";
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
const CHUNK_STEM = "[name]-[hash]";
const DEFAULT_OUT_DIR = "dist";
const DEFAULT_ASSETS_DIR = "assets";
const ENTRY_FILE_NAMES = BUNDLE_FILENAME;

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
    const assetsDir = viteConfig?.build?.assetsDir ?? DEFAULT_ASSETS_DIR;

    const forced: InlineConfig = {
        plugins: [
            ...gtkxVitePlugins(BUILD_MODE),
            gtkxWorker(),
            gtkxBuiltUrl(assetBase),
            gtkxNative(root),
            gtkxSelfContained(),
        ],
        build: {
            ssr: entry,
            assetsInlineLimit: 0,
            rolldownOptions: {
                output: {
                    entryFileNames: ENTRY_FILE_NAMES,
                    chunkFileNames: posix.join(assetsDir, CHUNK_STEM + ESM_EXTENSION),
                    keepNames: true,
                },
            },
        },
    };

    const merged: InlineConfig = mergeConfig(mergeConfig(buildDefaults, viteConfig ?? {}), forced);
    await viteBuild({ ...merged, ssr: { ...merged.ssr, noExternal: true } });

    return join(merged.build?.outDir ?? DEFAULT_OUT_DIR, ENTRY_FILE_NAMES);
};

export { build };
