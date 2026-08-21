import type { Element } from "stylis";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { escapeNamedColors, restoreNamedColors } from "./named-colors.js";

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

const removeLabel = (element: Element): void => {
    if (!(element.type === "decl" &&
        element.value.codePointAt(0) === LABEL_DECL_FIRST_CHAR &&
        element.value.codePointAt(2) === LABEL_DECL_THIRD_CHAR)) {
        return;
    }

    element.return = "";
    element.value = "";
};

const terminateDeclarations = (styles: string): string => {
    const trimmed = styles.trimEnd();

    if (trimmed.length === 0 || trimmed.endsWith(";") || trimmed.endsWith("}")) {
        return trimmed;
    }

    return `${trimmed};`;
};

const eachRule = (input: string, visit: (rule: string) => void): void => {
    stylisSerialize(
        compile(escapeNamedColors(input)),
        middleware([
            removeLabel,
            stringify,
            rulesheet((rule) => {
                visit(restoreNamedColors(rule));
            }),
        ]),
    );
};

export { eachRule, terminateDeclarations };
