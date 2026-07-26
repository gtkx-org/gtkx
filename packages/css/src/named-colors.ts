const AT_RULE_KEYWORDS: Set<string> = new Set(["define-color", "import", "keyframes", "media"]);
const AT_IDENTIFIER_PATTERN = /@([A-Za-z_][\w-]*)/g;
const NAMED_COLOR_TOKEN = "gtkx-named-color__";
const NAMED_COLOR_TOKEN_PATTERN = new RegExp(String.raw`${NAMED_COLOR_TOKEN}([\w-]+)`, "g");

const escapeNamedColors = (input: string): string =>
    input.replaceAll(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

const restoreNamedColors = (rule: string): string => rule.replaceAll(NAMED_COLOR_TOKEN_PATTERN, "@$1");

export { AT_RULE_KEYWORDS, NAMED_COLOR_TOKEN, escapeNamedColors, restoreNamedColors };
