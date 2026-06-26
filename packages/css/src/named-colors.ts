export const AT_RULE_KEYWORDS: Set<string> = new Set([
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

/**
 * Token prefix that stands in for a GTK `@named-color` reference while stylis
 * processes a stylesheet, since stylis would otherwise treat `@name` as an at-rule.
 */
export const NAMED_COLOR_TOKEN = "gtkx-named-color__";

const NAMED_COLOR_TOKEN_PATTERN = new RegExp(`${NAMED_COLOR_TOKEN}([\\w-]+)`, "g");

/**
 * Replace every GTK `@named-color` reference in `input` with {@link NAMED_COLOR_TOKEN}
 * so stylis does not parse it as an at-rule, leaving genuine CSS at-rules untouched.
 */
export const escapeNamedColors = (input: string): string =>
    input.replace(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

/**
 * Restore the `@named-color` references that {@link escapeNamedColors} tokenized,
 * applied to a rule emitted by stylis before it is inserted into the stylesheet.
 */
export const restoreNamedColors = (rule: string): string => rule.replace(NAMED_COLOR_TOKEN_PATTERN, "@$1");
