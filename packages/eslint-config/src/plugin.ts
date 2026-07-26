import { cognitiveComplexity } from "./rules/cognitive-complexity.js";
import { moduleSectionOrder } from "./rules/module-section-order.js";
import { noInlineExports } from "./rules/no-inline-exports.js";
import { statementPadding } from "./rules/statement-padding.js";

const gtkx = {
    meta: { name: "@gtkx/eslint-config" },
    rules: {
        "cognitive-complexity": cognitiveComplexity,
        "module-section-order": moduleSectionOrder,
        "no-inline-exports": noInlineExports,
        "statement-padding": statementPadding,
    },
};

export { gtkx };
