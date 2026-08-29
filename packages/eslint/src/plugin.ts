import { accessorNaming } from "./rules/accessor-naming.js";
import { brandNaming } from "./rules/brand-naming.js";
import { noComments } from "./rules/no-comments.js";
import { noInlineExports } from "./rules/no-inline-exports.js";
import { noLibraryPrefix } from "./rules/no-library-prefix.js";
import { publicApiJsdoc } from "./rules/public-api-jsdoc.js";
import { publicEntrypoints } from "./rules/public-entrypoints.js";

const gtkx = {
    meta: { name: "@gtkx/eslint" },
    rules: {
        "accessor-naming": accessorNaming,
        "brand-naming": brandNaming,
        "no-comments": noComments,
        "no-inline-exports": noInlineExports,
        "no-library-prefix": noLibraryPrefix,
        "public-api-jsdoc": publicApiJsdoc,
        "public-entrypoints": publicEntrypoints,
    },
};

export { gtkx };
