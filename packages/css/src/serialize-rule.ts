import type { Element, Middleware } from "stylis";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { escapeNamedColors } from "./named-colors.js";

const removeLabel = (element: Element): void => {
    if (element.type !== "decl" || element.props !== "label") {
        return;
    }

    element.return = "";
    element.value = "";
};

const stringifyGtk: Middleware = (element, index, children, callback) => {
    if (element.type === "@define-color") {
        element.return = element.value;

        return element.return;
    }

    return stringify(element, index, children, callback);
};

const terminateDeclarations = (styles: string): string => {
    const trimmed = styles.trimEnd();

    if (trimmed.length === 0 || trimmed.endsWith(";") || trimmed.endsWith("}")) {
        return trimmed;
    }

    return `${trimmed};`;
};

const eachRule = (input: string, visit: (rule: string) => void): void => {
    const escaped = escapeNamedColors(input);

    stylisSerialize(
        compile(escaped.css),
        middleware([
            removeLabel,
            stringifyGtk,
            rulesheet((rule) => {
                visit(escaped.restore(rule));
            }),
        ]),
    );
};

export { eachRule, terminateDeclarations };
