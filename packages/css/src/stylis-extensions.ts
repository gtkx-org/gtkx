import type { Middleware } from "stylis";

/**
 * The set of standard CSS/GTK at-rule identifiers that must keep their `@`
 * prefix through the stylis pipeline. Any `@identifier` not in this set is
 * treated as a GTK named color and is round-tripped through a sentinel token so
 * stylis does not misinterpret it as an at-rule.
 */
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
 * The sentinel prefix that replaces the `@` of a GTK named color while the rule
 * passes through stylis, isolating named colors from stylis at-rule handling.
 */
export const NAMED_COLOR_TOKEN = "gtkx-named-color__";

const NAMED_COLOR_TOKEN_PATTERN = new RegExp(`${NAMED_COLOR_TOKEN}([\\w-]+)`, "g");

/**
 * Replaces every GTK named color (`@identifier` not in {@link AT_RULE_KEYWORDS})
 * with a sentinel token so stylis does not treat it as an at-rule, while leaving
 * genuine at-rules untouched.
 *
 * @param input - The raw CSS source about to be compiled by stylis.
 * @returns The source with GTK named colors tokenized.
 */
export const escapeNamedColors = (input: string): string =>
    input.replace(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

/**
 * Restores the original `@` prefix of every GTK named color tokenized by
 * {@link escapeNamedColors} once a rule has been serialized by stylis.
 *
 * @param rule - A serialized CSS rule emitted by the stylis pipeline.
 * @returns The rule with GTK named colors restored to their `@identifier` form.
 */
export const restoreNamedColors = (rule: string): string => rule.replace(NAMED_COLOR_TOKEN_PATTERN, "@$1");

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

/**
 * A stylis middleware that strips Emotion `label:` declarations before they
 * reach the GTK sink, matching the declaration by its first and third
 * characters to avoid a substring scan.
 */
export const removeLabel: Middleware = (element) => {
    if (
        element.type === "decl" &&
        element.value.charCodeAt(0) === LABEL_DECL_FIRST_CHAR &&
        element.value.charCodeAt(2) === LABEL_DECL_THIRD_CHAR
    ) {
        element.return = "";
        element.value = "";
    }
};
