import { type InlineConfig, build as viteBuild } from "vite";
import { gtkxBuiltUrl } from "./vite-plugins/built-url.js";
import { gtkxVitePlugins } from "./vite-plugins/index.js";
import { gtkxNative } from "./vite-plugins/native.js";

export type BuildOptions = {
    entry: string;
    assetBase?: string | undefined;
    vite?: InlineConfig | undefined;
};

export const build = async (options: BuildOptions): Promise<void> => {
    const { entry, assetBase, vite: viteConfig } = options;
    const root = viteConfig?.root ?? process.cwd();

    await viteBuild({
        ...viteConfig,
        plugins: [...(viteConfig?.plugins ?? []), ...gtkxVitePlugins(), gtkxBuiltUrl(assetBase), gtkxNative(root)],
        build: {
            ...viteConfig?.build,
            ssr: entry,
            ssrEmitAssets: true,
            assetsInlineLimit: 0,
            outDir: viteConfig?.build?.outDir ?? "dist",
            minify: true,
            cssMinify: false,
            rolldownOptions: {
                ...viteConfig?.build?.rolldownOptions,
                output: {
                    ...((viteConfig?.build?.rolldownOptions?.output ?? {}) as Record<string, unknown>),
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
    });
};
