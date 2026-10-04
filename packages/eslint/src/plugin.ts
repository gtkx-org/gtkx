import { accessorNaming } from "./rules/accessor-naming.js";
import { brandNaming } from "./rules/brand-naming.js";
import { noComments } from "./rules/no-comments.js";
import { noInlineExports } from "./rules/no-inline-exports.js";

const gtkx = {
    meta: { name: "@gtkx/eslint" },
    rules: {
        "accessor-naming": accessorNaming,
        "brand-naming": brandNaming,
        "no-comments": noComments,
        "no-inline-exports": noInlineExports,
    },
};

export { gtkx };
