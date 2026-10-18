import type { CSSObject } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { serializeRule, terminateDeclarations } from "./serialize-rule.js";

const scopedRule = (className: string, style: object): string => {
    const declarations = terminateDeclarations(serializeStyles([style as CSSObject]).styles);

    if (declarations.length === 0) {
        return "";
    }

    return serializeRule(`.${className}{${declarations}}`);
};

export { scopedRule };
