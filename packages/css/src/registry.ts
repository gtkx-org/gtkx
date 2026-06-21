import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { compile, type Middleware, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { getStylesheet } from "./cache.js";

const CACHE_KEY = "gtkx";

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
    stylisSerialize(
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

const inserted = new Set<string>();
const registered: RegisteredCache = {};

/**
 * Serializes the given interpolations against the package's registered-style map,
 * resolving any previously generated class names interpolated into the call.
 */
export const serialize = (args: CSSInterpolation[]): SerializedStyles => serializeStyles(args, registered);

/**
 * Computes the GTK class name for a serialized style block.
 */
export const classNameFor = (serialized: SerializedStyles): string => `${CACHE_KEY}-${serialized.name}`;

/**
 * Looks up the serialized style text recorded for a registered class name, if any.
 */
export const registeredStylesFor = (className: string): string | undefined => registered[className];

/**
 * Inserts a serialized style block through the single dedup boundary, keyed by the
 * serialized name. When `scoped` is true the rule is wrapped in the generated class
 * selector and recorded for later interpolation and composition; otherwise the styles
 * are inserted unscoped. Repeated insertion of the same serialized name is a no-op.
 */
export const insert = (serialized: SerializedStyles, options: { scoped: boolean }): void => {
    if (inserted.has(serialized.name)) return;
    inserted.add(serialized.name);

    if (options.scoped) {
        const className = classNameFor(serialized);
        insertRules(`.${className}{${serialized.styles}}`);
        registered[className] = serialized.styles;
    } else {
        insertRules(serialized.styles);
    }
};
