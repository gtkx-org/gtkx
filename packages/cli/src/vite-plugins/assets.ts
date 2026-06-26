import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { createVirtualNamespace } from "./virtual-module.js";

const CSS_RE = /\.css$/i;
const INJECT_SUFFIX = "?inject";
const VIRTUAL_PREFIX = "\0gtkx:";
const { isVirtual, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

export function gtkxAssets(): Plugin {
    return {
        name: "gtkx:assets",
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
                const content = readFileSync(filePath, "utf-8");
                return [`import { injectGlobal } from "@gtkx/css";`, `injectGlobal(${JSON.stringify(content)});`].join(
                    "\n",
                );
            }

            return;
        },
    };
}
