import postcss from "postcss";
import nested from "postcss-nested";
import selectorParser from "postcss-selector-parser";

const AT_RULE_KEYWORDS: Set<string> = new Set(["define-color", "import", "keyframes", "media"]);

const rootSelector = selectorParser((root) => {
    root.walkNesting((node) => {
        node.remove();
    });
    root.each((selector) => {
        if (selector.toString().trim().length === 0) {
            selector.remove();
        }
    });
});

const processor = postcss([
    {
        postcssPlugin: "gtkx-css",
        Once(root) {
            root.raws.semicolon = true;
            root.walk((node) => {
                if (node.type === "decl" && node.prop === "label") {
                    node.remove();
                }

                if (node.type === "atrule" && AT_RULE_KEYWORDS.has(node.name.toLowerCase())) {
                    node.name = node.name.toLowerCase();
                }

                if ((node.type === "rule" || node.type === "atrule") && node.nodes !== undefined) {
                    node.raws.semicolon = true;
                    node.prepend(node.nodes.filter((child) => child.type === "decl"));
                }
            });
        },
        OnceExit(root) {
            root.walkRules((rule) => {
                if (!rule.selector.includes("&")) {
                    return;
                }

                rule.selector = rootSelector.processSync(rule.selector).trim();

                if (rule.selector.length === 0) {
                    rule.remove();
                }
            });
        },
    },
    nested({ unwrap: ["define-color", "import"] }),
]);

const terminateDeclarations = (styles: string): string => {
    const trimmed = styles.trimEnd();

    if (trimmed.length === 0 || trimmed.endsWith(";") || trimmed.endsWith("}")) {
        return trimmed;
    }

    return `${trimmed};`;
};

const serializeRule = (input: string): string => processor.process(input, { from: undefined }).css;

export { serializeRule, terminateDeclarations };
