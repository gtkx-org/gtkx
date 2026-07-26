import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { createVirtualNamespace } from "./virtual-module.js";

const CSS_RE = /\.css$/i;
const INJECT_SUFFIX = "?inject";
const VIRTUAL_PREFIX = "\0gtkx-css:";
const { isVirtual, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

export function gtkxCss(): Plugin {
    return {
        name: "gtkx:css",
        enforce: "pre",

        async resolveId(source, importer, options) {
            if (!CSS_RE.test(source)) {
                return;
            }

            const virtualId = await resolveToVirtual(this, { source, importer, options });
            if (virtualId === undefined) return;

            return virtualId + INJECT_SUFFIX;
        },

        load(id) {
            if (isVirtual(id) && id.endsWith(INJECT_SUFFIX)) {
                const filePath = fromVirtualId(id.slice(0, -INJECT_SUFFIX.length));
                const content = readFileSync(filePath, "utf8");
                return ["import { injectGlobal } from \"@gtkx/css\";", `injectGlobal(${JSON.stringify(content)});`].join(
                    "\n",
                );
            }

            return;
        },
    };
}
