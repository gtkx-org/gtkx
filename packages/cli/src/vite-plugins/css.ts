import type { Plugin } from "vite";
import { isRecord } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { RESOURCE_RESOLVE_OPTION } from "./resource-shared.js";
import { createVirtualNamespace } from "./virtual-module.js";

type CssResolveContext = Parameters<typeof resolveToVirtual>[0];
type CssResolveRequest = Parameters<typeof resolveToVirtual>[1];
type CssLoadContext = { addWatchFile: (file: string) => void };

const CSS_RE = /\.css$/i;
const INJECT_SUFFIX = ".js";
const VIRTUAL_PREFIX = "\0gtkx-css:";
const VIRTUAL_ID_RE = new RegExp(`^${VIRTUAL_PREFIX}`);
const { isVirtual, toVirtualId, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

const injectedCssId = (filePath: string): string => toVirtualId(filePath) + INJECT_SUFFIX;

const isResourceResolve = (options: CssResolveRequest["options"]): boolean => {
    const custom = options?.["custom"];

    return isRecord(custom) && custom[RESOURCE_RESOLVE_OPTION] === true;
};

const resolveCssId = async (
    ctx: CssResolveContext,
    request: CssResolveRequest,
): Promise<{ id: string; moduleSideEffects: true } | undefined> => {
    if (!CSS_RE.test(request.source) || isResourceResolve(request.options)) {
        return;
    }

    const virtualId = await resolveToVirtual(ctx, request);

    if (virtualId === undefined) {
        return;
    }

    return { id: injectedCssId(fromVirtualId(virtualId)), moduleSideEffects: true };
};

const loadInjectedCss = (ctx: CssLoadContext, id: string): string | undefined => {
    if (!isVirtual(id) || !id.endsWith(INJECT_SUFFIX)) {
        return;
    }

    const filePath = fromVirtualId(id.slice(0, -INJECT_SUFFIX.length));
    const content = readFileSync(filePath, "utf8");
    ctx.addWatchFile(filePath);

    return ['import { injectGlobal } from "@gtkx/css";', `injectGlobal(${JSON.stringify(content)});`].join("\n");
};

function gtkxCss(): Plugin {
    return {
        name: "gtkx:css",
        enforce: "pre",

        resolveId: {
            filter: { id: CSS_RE },

            handler(source, importer, options) {
                return resolveCssId(this, { source, importer, options });
            },
        },

        load: {
            filter: { id: VIRTUAL_ID_RE },

            handler(id) {
                return loadInjectedCss(this, id);
            },
        },
    };
}

export { gtkxCss, injectedCssId };
