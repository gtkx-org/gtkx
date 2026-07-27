import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { createVirtualNamespace } from "./virtual-module.js";

type CssResolveContext = Parameters<typeof resolveToVirtual>[0];
type CssResolveRequest = Parameters<typeof resolveToVirtual>[1];

const CSS_RE = /\.css$/i;
const INJECT_SUFFIX = "?inject";
const VIRTUAL_PREFIX = "\0gtkx-css:";
const { isVirtual, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

const resolveCssId = async (ctx: CssResolveContext, request: CssResolveRequest): Promise<string | undefined> => {
    if (!CSS_RE.test(request.source)) {
        return;
    }

    const virtualId = await resolveToVirtual(ctx, request);

    if (virtualId === undefined) {
        return;
    }

    return virtualId + INJECT_SUFFIX;
};

const loadInjectedCss = (id: string): string | undefined => {
    if (!isVirtual(id) || !id.endsWith(INJECT_SUFFIX)) {
        return;
    }

    const filePath = fromVirtualId(id.slice(0, -INJECT_SUFFIX.length));
    const content = readFileSync(filePath, "utf8");

    return ["import { injectGlobal } from \"@gtkx/css\";", `injectGlobal(${JSON.stringify(content)});`].join("\n");
};

function gtkxCss(): Plugin {
    return {
        name: "gtkx:css",
        enforce: "pre",

        resolveId(source, importer, options) {
            return resolveCssId(this, { source, importer, options });
        },

        load(id) {
            return loadInjectedCss(id);
        },
    };
}

export { gtkxCss };
