import type { Element } from "stylis";

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

/**
 * Stylis middleware that drops Emotion `label:` declarations from compiled output,
 * since they carry no style and are only used for development-time class naming.
 */
export const removeLabel = (element: Element): void => {
    if (
        element.type === "decl" &&
        element.value.codePointAt(0) === LABEL_DECL_FIRST_CHAR &&
        element.value.codePointAt(2) === LABEL_DECL_THIRD_CHAR
    ) {
        element.return = "";
        element.value = "";
    }
};
