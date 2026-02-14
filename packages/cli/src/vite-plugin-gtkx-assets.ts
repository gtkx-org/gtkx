import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const ASSET_RE = /\.(png|jpe?g|gif|svg|webp|webm|mp4|ogg|mp3|wav|flac|aac|woff2?|eot|ttf|otf|ico|avif|data)$/i;
const CSS_RE = /\.css$/i;
const VIRTUAL_PREFIX = "\0gtkx:";

/**
 * Vite plugin that resolves static asset imports to filesystem paths
 * and handles CSS imports for GTK applications.
 *
 * **Non-CSS assets:** In dev mode, asset imports resolve to the absolute
 * source file path. In build mode, Vite's built-in asset pipeline handles
 * emission and hashing; the `renderBuiltUrl` config in the builder
 * converts the URL to a filesystem path via `import.meta.url`.
 *
 * **CSS imports (`import "./style.css"`):** Transformed into a module that
 * calls `injectGlobal` from `@gtkx/css` with the file's contents, injecting
 * the styles into the GTK CSS provider at runtime.
 *
 * **CSS URL imports (`import path from "./style.css?url"`):** Handled by
 * Vite's built-in `?url` mechanism, which emits the file as an asset and
 * resolves it to a filesystem path via `renderBuiltUrl`.
 */
export function gtkxAssets(): Plugin {
    let isBuild = false;

    return {
        name: "gtkx:assets",
        enforce: "pre",

        config() {
            return {
                assetsInclude: [ASSET_RE],
            };
        },

        configResolved(config) {
            isBuild = config.command === "build";
        },

        async resolveId(source, importer, options) {
            if (!CSS_RE.test(source)) {
                return;
            }

            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
            if (!resolved || resolved.external) return;

            return `${VIRTUAL_PREFIX + resolved.id}?inject`;
        },

        load(id) {
            if (id.startsWith(VIRTUAL_PREFIX) && id.endsWith("?inject")) {
                const filePath = id.slice(VIRTUAL_PREFIX.length, -"?inject".length);
                const content = readFileSync(filePath, "utf-8");
                return [`import { injectGlobal } from "@gtkx/css";`, `injectGlobal(${JSON.stringify(content)});`].join(
                    "\n",
                );
            }

            if (isBuild || !ASSET_RE.test(id)) {
                return;
            }

            return `export default ${JSON.stringify(id)};`;
        },
    };
}
