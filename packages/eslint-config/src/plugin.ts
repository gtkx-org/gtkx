import { cognitiveComplexity } from "./rules/cognitive-complexity.js";

export const gtkx = {
    meta: { name: "@gtkx/eslint-config" },
    rules: {
        "cognitive-complexity": cognitiveComplexity,
    },
};
