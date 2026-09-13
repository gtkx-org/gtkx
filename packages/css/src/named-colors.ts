const AT_RULE_KEYWORDS: Set<string> = new Set(["define-color", "import", "keyframes", "media"]);
const AT_IDENTIFIER_PATTERN = /@([A-Za-z_][\w-]*)/g;
const NAMED_COLOR_TOKEN = "gtkx-named-color__";

type NamedColorEscaping = { css: string; restore: (rule: string) => string };

const availableToken = (input: string): string => {
    let token = NAMED_COLOR_TOKEN;

    while (input.includes(token)) {
        token += "_";
    }

    return token;
};

const escapeNamedColors = (input: string): NamedColorEscaping => {
    const token = availableToken(input);
    const pattern = new RegExp(String.raw`${token}([\w-]+)`, "g");
    const css = input.replaceAll(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${token}${name}`,
    );

    return { css, restore: (rule) => rule.replaceAll(pattern, "@$1") };
};

export { escapeNamedColors };
