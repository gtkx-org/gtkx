import { type InlineConfig, build as viteBuild } from "vite";
import { gtkxAssets } from "./vite-plugin-gtkx-assets.js";
import { gtkxBuiltUrl } from "./vite-plugin-gtkx-built-url.js";
import { gtkxGSettings } from "./vite-plugin-gtkx-gsettings.js";
import { gtkxNative } from "./vite-plugin-gtkx-native.js";

/**
 * Options for building a GTKX application for production.
 */
export type BuildOptions = {
    /** Path to the entry file (e.g., "src/index.tsx") */
    entry: string;
    /**
     * Base path for resolving asset imports at runtime, relative to the
     * executable directory.
     *
     * When set, asset imports resolve to
     * `path.join(path.dirname(process.execPath), assetBase, filename)`.
     * This is useful for FHS-compliant packaging where assets live under
     * a `share/` directory rather than next to the binary.
     *
     * When omitted, assets resolve relative to the bundle via
     * `import.meta.url`, which works when assets are co-located with
     * the executable (e.g., in `bin/assets/`).
     *
     * @example
     * ```ts
     * await build({
     *     entry: "./src/index.tsx",
     *     assetBase: "../share/my-app",
     * });
     * ```
     */
    assetBase?: string;
    /** Additional Vite configuration */
    vite?: InlineConfig;
};

/**
 * Builds a GTKX application for production using Vite's SSR build mode.
 *
 * Produces a single minified ESM bundle at `dist/bundle.js` with all
 * dependencies inlined. The native `.node` binary is copied into the
 * output directory as `gtkx.node`, making the bundle fully self-contained
 * with no `node_modules` dependency at runtime.
 *
 * The user entry is the bundle's only entry point: it is expected to call
 * `render(<App />, app)` at top level, mirroring the
 * `createRoot().render()` pattern used in `react-dom`.
 *
 * @param options - Build configuration including entry point and Vite options
 *
 * @example
 * ```ts
 * import { build } from "@gtkx/cli";
 *
 * await build({
 *     entry: "./src/index.tsx",
 *     vite: { root: process.cwd() },
 * });
 * ```
 *
 * @see {@link BuildOptions} for configuration options
 */
export const build = async (options: BuildOptions): Promise<void> => {
    const { entry, assetBase, vite: viteConfig } = options;
    const root = viteConfig?.root ?? process.cwd();

    await viteBuild({
        ...viteConfig,
        plugins: [
            ...(viteConfig?.plugins ?? []),
            gtkxGSettings(),
            gtkxAssets(),
            gtkxBuiltUrl(assetBase),
            gtkxNative(root),
        ],
        build: {
            ...viteConfig?.build,
            ssr: entry,
            ssrEmitAssets: true,
            assetsInlineLimit: 0,
            outDir: viteConfig?.build?.outDir ?? "dist",
            minify: true,
            cssMinify: false,
            rollupOptions: {
                ...viteConfig?.build?.rollupOptions,
                output: {
                    ...((viteConfig?.build?.rollupOptions?.output ?? {}) as Record<string, unknown>),
                    entryFileNames: "bundle.js",
                },
            },
        },
        define: {
            ...viteConfig?.define,
            "process.env.NODE_ENV": JSON.stringify("production"),
        },
        ssr: {
            ...viteConfig?.ssr,
            noExternal: true,
        },
        experimental: {
            ...viteConfig?.experimental,
        },
    });
};
