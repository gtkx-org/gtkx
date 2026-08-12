import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type InlineConfig, mergeConfig, build as viteBuild } from "vite";
import { gtkxBuiltUrl } from "./vite-plugins/built-url.js";
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
const MANIFEST_NAME = "package.json";
const MODULE_PACKAGE_TYPE = "module";
const BUNDLE_NAME = "bundle.js";
const ESM_BUNDLE_NAME = "bundle.mjs";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const nearestManifest = (dir: string): string | null => {
    const candidate = join(dir, MANIFEST_NAME);

    if (existsSync(candidate)) {
        return candidate;
    }

    const parent = dirname(dir);

    return parent === dir ? null : nearestManifest(parent);
};

const parseManifest = (manifestPath: string): unknown => {
    try {
        return JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
        return null;
    }
};

const packageType = (root: string): string | null => {
    const manifestPath = nearestManifest(resolve(root));

    if (manifestPath === null) {
        return null;
    }

    const manifest = parseManifest(manifestPath);

    if (!isRecord(manifest)) {
        return null;
    }

    return typeof manifest.type === "string" ? manifest.type : null;
};

const bundleName = (root: string): string =>
    packageType(root) === MODULE_PACKAGE_TYPE ? BUNDLE_NAME : ESM_BUNDLE_NAME;

const build = async (options: BuildOptions): Promise<string> => {
    const { entry, assetBase, vite: viteConfig } = options;
    const root = viteConfig?.root ?? process.cwd();
    const entryFileNames = bundleName(root);

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
