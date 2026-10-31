import type { Plugin, UserConfig } from "vite";
import { viteProjectRoot } from "@gtkx/config/internal";
import { crawlFrameworkPkgs } from "vitefu";

const dependsOnRenderer = (manifest: Record<string, Record<string, string> | undefined>): boolean =>
    [manifest["dependencies"], manifest["peerDependencies"]].some(
        (dependencies) => dependencies !== undefined && Object.hasOwn(dependencies, "@gtkx/react"),
    );

function gtkxRendererLibraries(): Plugin {
    return {
        name: "gtkx:renderer-libraries",

        async config(config: UserConfig) {
            const crawled = await crawlFrameworkPkgs({
                root: viteProjectRoot(config),
                isBuild: false,
                viteUserConfig: config,
                isFrameworkPkgByJson: dependsOnRenderer,
            });

            return { ssr: { noExternal: crawled.ssr.noExternal } };
        },
    };
}

export { gtkxRendererLibraries };
