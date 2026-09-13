import { parse } from "postcss";

const AT_RULE_KEYWORDS: Set<string> = new Set(["define-color", "import", "keyframes", "media"]);
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
    const root = parse(input);
    const escape = (value: string): string => value.replaceAll("@", () => token);

    root.walkDecls((declaration) => {
        declaration.value = escape(declaration.value);
    });

    root.walkAtRules((rule) => {
        const name = rule.name.toLowerCase();

        if (AT_RULE_KEYWORDS.has(name)) {
            rule.name = name;
        }

        if (name === "define-color") {
            rule.params = escape(rule.params);
        }
    });

    return { css: root.toString(), restore: (rule) => rule.replaceAll(token, "@") };
};

export { escapeNamedColors };
