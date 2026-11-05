import type { Plugin } from "vite";
import { isRecord } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postcss from "postcss";
import { RESOURCE_RESOLVE_OPTION } from "./resource-shared.js";
import { createVirtualNamespace } from "./virtual-module.js";

type CssResolveContext = Parameters<typeof resolveToVirtual>[0];
type CssResolveRequest = Parameters<typeof resolveToVirtual>[1];
type CssLoadContext = { addWatchFile: (file: string) => void; warn: (message: string) => void };

const CSS_RE = /\.css$/i;
const INJECT_SUFFIX = ".js";
const VIRTUAL_PREFIX = "\0gtkx-css:";
const VIRTUAL_ID_RE = new RegExp(`^${VIRTUAL_PREFIX}`);
const INJECTED_CSS_ID_RE = new RegExp(`^${VIRTUAL_PREFIX}.*\\${INJECT_SUFFIX}$`);
const CSS_URL_RE = /(?<=^|[^\w\-\u0080-\uffff])url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)/g;
const CSS_IMPORT_TARGET_RE = /^\s*(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)|"([^"]*)"|'([^']*)')\s*$/;
const NON_RELATIVE_URL_RE = /^(?:[a-z][a-z\d+.-]*:|\/|#|$)/i;
const ABSOLUTE_PATH_RE = /^\//;
const URL_PLACEHOLDER_RE = /\0gtkx-css-url:(\d+)\0/;
const { isVirtual, toVirtualId, fromVirtualId, resolveToVirtual } = createVirtualNamespace(VIRTUAL_PREFIX);

type BundledStylesheet = {
    imports: string[];
    urls: string[];
    absolutePaths: string[];
    css: string;
};

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

const quotedTarget = (groups: (string | undefined)[]): string => groups.find((group) => group !== undefined) ?? "";

const bundleStylesheet = (filePath: string, content: string): BundledStylesheet => {
    const root = postcss.parse(content, { from: filePath });
    const imports: string[] = [];
    const urls: string[] = [];
    const absolutePaths: string[] = [];
    const resolveTarget = (target: string): string | null => {
        if (ABSOLUTE_PATH_RE.test(target)) {
            absolutePaths.push(target);
        }

        return NON_RELATIVE_URL_RE.test(target) ? null : resolve(dirname(filePath), target);
    };

    root.walkAtRules("import", (rule) => {
        const match = CSS_IMPORT_TARGET_RE.exec(rule.params);
        const target = match === null ? null : resolveTarget(quotedTarget(match.slice(1)));

        if (target !== null) {
            imports.push(target);
            rule.remove();
        }
    });

    root.walkDecls((decl) => {
        decl.value = decl.value.replace(CSS_URL_RE, (url: string, ...groups: (string | undefined)[]) => {
            const target = resolveTarget(quotedTarget(groups.slice(0, 3)));

            if (target === null) {
                return url;
            }

            return `url(\0gtkx-css-url:${String(urls.push(target) - 1)}\0)`;
        });
    });

    return { imports, urls, absolutePaths, css: root.toString() };
};

const injectedCssExpression = (css: string): string =>
    css
        .split(URL_PLACEHOLDER_RE)
        .map((part, index) =>
            index % 2 === 0 ? JSON.stringify(part) : `JSON.stringify("resource://" + stylesheetUrl${part})`,
        )
        .join(" + ");

const loadInjectedCss = (ctx: CssLoadContext, id: string): string | undefined => {
    if (!isVirtual(id) || !id.endsWith(INJECT_SUFFIX)) {
        return;
    }

    const filePath = fromVirtualId(id.slice(0, -INJECT_SUFFIX.length));
    const { imports, urls, absolutePaths, css } = bundleStylesheet(filePath, readFileSync(filePath, "utf8"));
    ctx.addWatchFile(filePath);

    for (const path of absolutePaths) {
        ctx.warn(
            `${filePath} refers to "${path}", an absolute path GTK cannot load from an imported stylesheet. ` +
                "Use a path relative to the stylesheet or a resource:// URI.",
        );
    }

    return [
        'import { injectGlobal } from "@gtkx/css";',
        ...imports.map((target) => `import ${JSON.stringify(target)};`),
        ...urls.map(
            (target, index) => `import stylesheetUrl${String(index)} from ${JSON.stringify(`${target}?resource`)};`,
        ),
        `injectGlobal(${injectedCssExpression(css)});`,
    ].join("\n");
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

export { gtkxCss, INJECTED_CSS_ID_RE, injectedCssId };
