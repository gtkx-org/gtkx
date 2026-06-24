import type { Element } from "stylis";

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

export const NAMED_COLOR_TOKEN = "gtkx-named-color__";

const NAMED_COLOR_TOKEN_PATTERN = new RegExp(`${NAMED_COLOR_TOKEN}([\\w-]+)`, "g");

export const escapeNamedColors = (input: string): string =>
    input.replace(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

export const restoreNamedColors = (rule: string): string => rule.replace(NAMED_COLOR_TOKEN_PATTERN, "@$1");

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

export const removeLabel = (element: Element): void => {
    if (
        element.type === "decl" &&
        element.value.codePointAt(0) === LABEL_DECL_FIRST_CHAR &&
        element.value.codePointAt(2) === LABEL_DECL_THIRD_CHAR
    ) {
        element.return = "";
        element.value = "";
    }
};
