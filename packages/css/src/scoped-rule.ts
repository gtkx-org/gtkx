import type { CSSObject } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { eachRule, terminateDeclarations } from "./serialize-rule.js";

const scopedRule = (className: string, style: object): string => {
    const declarations = terminateDeclarations(serializeStyles([style as CSSObject]).styles);

    if (declarations.length === 0) {
        return "";
    }

    const rules: string[] = [];

    eachRule(`.${className}{${declarations}}`, (rule) => {
        rules.push(rule);
    });

    return rules.join("");
};

export { scopedRule };
