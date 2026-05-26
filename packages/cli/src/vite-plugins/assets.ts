import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const CSS_RE = /\.css$/i;
const VIRTUAL_PREFIX = "\0gtkx:";

/**
 * Vite plugin that converts bare CSS imports into runtime
 * `injectGlobal` calls.
 *
 * Intercepts `import "./style.css"` (side-effect form) and rewrites it to
 * a virtual module whose body reads the file at build/dev time and calls
 * `injectGlobal` from `@gtkx/css`, installing the stylesheet into the GTK
 * CSS provider when the importing module is evaluated.
 *
 * Binary asset imports (images, fonts, video, etc.) are owned by
 * `gtkxResources`, which routes them through the GResource pipeline.
 */
export function gtkxAssets(): Plugin {
    return {
        name: "gtkx:assets",
        enforce: "pre",

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

            return;
        },
    };
}
