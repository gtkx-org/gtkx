import type { CSSInterpolation } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { compile, type Middleware, middleware, rulesheet, serialize, stringify } from "stylis";
import { getCache, getStylesheet } from "./cache.js";

const AT_RULE_KEYWORDS = new Set([
    "binding-set",
    "charset",
    "define-color",
    "document",
    "font-face",
    "import",
    "keyframes",
    "media",
    "namespace",
    "page",
    "supports",
]);
const AT_IDENTIFIER_PATTERN = /@([A-Za-z_][\w-]*)/g;
const NAMED_COLOR_TOKEN = "gtkx-named-color__";
const NAMED_COLOR_TOKEN_PATTERN = new RegExp(`${NAMED_COLOR_TOKEN}([\\w-]+)`, "g");

const escapeNamedColors = (input: string): string =>
    input.replace(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

const restoreNamedColors = (rule: string): string => rule.replace(NAMED_COLOR_TOKEN_PATTERN, "@$1");

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

const removeLabel: Middleware = (element) => {
    if (
        element.type === "decl" &&
        element.value.charCodeAt(0) === LABEL_DECL_FIRST_CHAR &&
        element.value.charCodeAt(2) === LABEL_DECL_THIRD_CHAR
    ) {
        element.return = "";
        element.value = "";
    }
};

const insertRules = (input: string): void => {
    const stylesheet = getStylesheet();
    serialize(
        compile(escapeNamedColors(input)),
        middleware([
            removeLabel,
            stringify,
            rulesheet((rule) => {
                stylesheet.insert(restoreNamedColors(rule));
            }),
        ]),
    );
};

export const css = (...args: CSSInterpolation[]): string => {
    const cache = getCache();
    const serialized = serializeStyles(args, cache.registered);
    const className = `${cache.key}-${serialized.name}`;

    if (cache.inserted[serialized.name] === undefined) {
        insertRules(`.${className}{${serialized.styles}}`);
        cache.inserted[serialized.name] = true;
        cache.registered[className] = serialized.styles;
    }

    return className;
};

export const cx = (...classNames: (string | boolean | undefined | null)[]): string[] =>
    classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0);

export const injectGlobal = (...args: CSSInterpolation[]): void => {
    const cache = getCache();
    const serialized = serializeStyles(args, cache.registered);
    const insertedKey = `global-${serialized.name}`;

    if (cache.inserted[insertedKey] === undefined) {
        insertRules(serialized.styles);
        cache.inserted[insertedKey] = true;
    }
};
