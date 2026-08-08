import { accessorNaming } from "./rules/accessor-naming.js";
import { brandNaming } from "./rules/brand-naming.js";
import { cognitiveComplexity } from "./rules/cognitive-complexity.js";
import { moduleSectionOrder } from "./rules/module-section-order.js";
import { noComments } from "./rules/no-comments.js";
import { noInlineExports } from "./rules/no-inline-exports.js";
import { noLibraryPrefix } from "./rules/no-library-prefix.js";
import { publicApiJsdoc } from "./rules/public-api-jsdoc.js";
import { publicEntrypoints } from "./rules/public-entrypoints.js";
import { statementPadding } from "./rules/statement-padding.js";

const gtkx = {
    meta: { name: "@gtkx/eslint" },
    rules: {
        "accessor-naming": accessorNaming,
        "brand-naming": brandNaming,
        "cognitive-complexity": cognitiveComplexity,
        "module-section-order": moduleSectionOrder,
        "no-comments": noComments,
        "no-inline-exports": noInlineExports,
        "no-library-prefix": noLibraryPrefix,
        "public-api-jsdoc": publicApiJsdoc,
        "public-entrypoints": publicEntrypoints,
        "statement-padding": statementPadding,
    },
};

export { gtkx };
