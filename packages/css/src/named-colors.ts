export const AT_RULE_KEYWORDS: Set<string> = new Set(["define-color", "import", "keyframes", "media"]);

const AT_IDENTIFIER_PATTERN = /@([A-Za-z_][\w-]*)/g;

export const NAMED_COLOR_TOKEN = "gtkx-named-color__";

const NAMED_COLOR_TOKEN_PATTERN = new RegExp(`${NAMED_COLOR_TOKEN}([\\w-]+)`, "g");

export const escapeNamedColors = (input: string): string =>
    input.replace(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

export const restoreNamedColors = (rule: string): string => rule.replace(NAMED_COLOR_TOKEN_PATTERN, "@$1");
