import type { ParseResult, Plugin } from "vite";
import { parseSync } from "vite";
import { sourceLanguage } from "../internal/source-imports.js";
import { INJECTED_CSS_ID_RE } from "./css.js";
import { stripQuery } from "./strip-query.js";

type ModuleRequest = ParseResult["module"]["staticImports"][number]["moduleRequest"];

const CSS_SOURCE = "@gtkx/css";
const OWNER_SPECIFIER_PREFIX = "virtual:gtkx-global-styles/";
const OWNER_ID_PREFIX = "\0gtkx-global-styles:";
const OWNER_SPECIFIER_RE = new RegExp(`^${OWNER_SPECIFIER_PREFIX}`);
const OWNER_ID_RE = new RegExp(`^${OWNER_ID_PREFIX}`);

const ownedCssModule = (owner: string): string =>
    [
        `export * from "${CSS_SOURCE}";`,
        `import { injectGlobalFor } from "${CSS_SOURCE}/internal";`,
        `export const injectGlobal = injectGlobalFor(${JSON.stringify(owner)});`,
    ].join("\n");

const cssRequests = (code: string, id: string): ModuleRequest[] => {
    const lang = sourceLanguage(stripQuery(id));

    if (lang === undefined) {
        return [];
    }

    const { module, errors } = parseSync(id, code, { lang });

    if (errors.length > 0) {
        return [];
    }

    const requests = [
        ...module.staticImports.map((statement) => statement.moduleRequest),
        ...module.staticExports.flatMap((statement) => statement.entries.map((entry) => entry.moduleRequest)),
    ].filter((request): request is ModuleRequest => request?.value === CSS_SOURCE);

    return [...new Map(requests.map((request) => [request.start, request])).values()].sort((a, b) => b.start - a.start);
};

const replaceRequests = (code: string, requests: ModuleRequest[], specifier: string): string =>
    requests.reduce(
        (rewritten, request) =>
            rewritten.slice(0, request.start) + JSON.stringify(specifier) + rewritten.slice(request.end),
        code,
    );

function gtkxGlobalStyles(): Plugin {
    const owners: string[] = [];

    return {
        name: "gtkx:global-styles",
        enforce: "pre",
        apply: "serve",

        resolveId: {
            filter: { id: OWNER_SPECIFIER_RE },

            handler(source) {
                return OWNER_ID_PREFIX + source.slice(OWNER_SPECIFIER_PREFIX.length);
            },
        },

        load: {
            filter: { id: OWNER_ID_RE },

            handler(id) {
                const owner = owners[Number(id.slice(OWNER_ID_PREFIX.length))];

                return owner === undefined ? undefined : ownedCssModule(owner);
            },
        },

        transform: {
            filter: { id: INJECTED_CSS_ID_RE, code: CSS_SOURCE },

            handler(code, id) {
                const requests = cssRequests(code, id);

                if (requests.length === 0) {
                    return;
                }

                const specifier = OWNER_SPECIFIER_PREFIX + String(owners.push(stripQuery(id)) - 1);

                return { code: replaceRequests(code, requests, specifier), map: null };
            },
        },
    };
}

export { gtkxGlobalStyles };
