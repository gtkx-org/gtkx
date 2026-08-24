import { join, posix, resolve } from "node:path";
import { type InlineConfig, mergeConfig, type Plugin, type ResolvedConfig, build as viteBuild } from "vite";
import { listFilesRecursive } from "./internal/list-files.js";
import { inspectProjectPath } from "./internal/project-path.js";
import { gtkxBuiltUrl } from "./vite-plugins/built-url.js";
import { gtkxBundledPackages } from "./vite-plugins/bundled-packages.js";
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
        rolldownOptions: {
            checks: {
                pluginTimings: false,
            },
        },
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(BUILD_MODE),
    },
};

const assertCanonicalOutput = (config: ResolvedConfig): void => {
    const output = config.build.rolldownOptions.output;

    if (Array.isArray(output)) {
        throw new TypeError("GTKX builds require one canonical output directory");
    }

    const configured = output?.dir;
    const canonical = resolve(config.root, config.build.outDir);

    if (typeof configured === "string" && resolve(config.root, configured) !== canonical) {
        throw new Error("GTKX builds require Rolldown output in the canonical build directory");
    }

    if (!config.build.write || !config.build.emptyOutDir) {
        throw new Error("GTKX builds must write a fresh canonical output tree");
    }
};

const assertSafeOutput = (root: string, configured: string, config: ResolvedConfig): void => {
    const outDir = resolve(config.root, configured);
    const stats = inspectProjectPath({ root, candidate: outDir, configured, subject: "build output directory" });

    if (stats !== undefined && !stats.isDirectory()) {
        throw new Error(`Cannot use "${configured}" as the build output directory below ${root}`);
    }

    if (stats !== undefined) {
        listFilesRecursive(outDir);
    }
};

const outputBoundary = (root: string): Plugin => ({
    name: "gtkx:output-boundary",
    configResolved(config) {
        assertCanonicalOutput(config);
        assertSafeOutput(root, config.build.outDir, config);
    },
});

const build = async (options: BuildOptions): Promise<string> => {
    const { entry, assetBase, vite: viteConfig } = options;
    const root = resolve(viteConfig?.root ?? process.cwd());
    const assetsDir = viteConfig?.build?.assetsDir ?? DEFAULT_ASSETS_DIR;

    const forced: InlineConfig = {
        plugins: [
            outputBoundary(root),
            ...gtkxVitePlugins(BUILD_MODE),
            gtkxWorker(),
            gtkxBuiltUrl(assetBase),
            gtkxNative(root),
            gtkxBundledPackages(root),
            gtkxSelfContained(),
        ],
        build: {
            ssr: entry,
            write: true,
            emptyOutDir: true,
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
