import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import type { Element } from "stylis";
import { serializeStyles } from "@emotion/serialize";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { escapeNamedColors, restoreNamedColors } from "./named-colors.js";
import { StyleSheet } from "./stylesheet.js";

type CxToken = string | boolean | undefined | null;

type Css = {
    css: (...args: CSSInterpolation[]) => string;
    cx: (...classNames: CxToken[]) => string[];
    injectGlobal: (...args: CSSInterpolation[]) => void;
};

type TokenPartition = { rawClasses: string[]; registeredStyles: string[] };
type CssState = { sheet: StyleSheet; inserted: Set<string>; registered: RegisteredCache };

const KEY = "gtkx";
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

const getClassName = (serialized: SerializedStyles): string => `${KEY}-${serialized.name}`;
const isNonEmptyString = (token: CxToken): token is string => typeof token === "string" && token.length > 0;

const partitionTokens = (tokens: string[], registered: RegisteredCache): TokenPartition => {
    const rawClasses: string[] = [];
    const registeredStyles: string[] = [];

    for (const token of tokens) {
        const styles = registered[token];

        if (styles === undefined) {
            rawClasses.push(token);
        } else {
            registeredStyles.push(styles);
        }
    }

    return { rawClasses, registeredStyles };
};

const runStylis = (sheet: StyleSheet, input: string): void => {
    stylisSerialize(
        compile(escapeNamedColors(input)),
        middleware([
            removeLabel,
            stringify,
            rulesheet((rule) => {
                sheet.insert(restoreNamedColors(rule));
            }),
        ]),
    );
};

const didMarkNewStyle = (state: CssState, serialized: SerializedStyles): boolean => {
    if (state.inserted.has(serialized.name)) {
        return false;
    }

    state.inserted.add(serialized.name);

    return true;
};

const insertStyles = (state: CssState, serialized: SerializedStyles): void => {
    if (!didMarkNewStyle(state, serialized)) {
        return;
    }

    const className = getClassName(serialized);
    runStylis(state.sheet, `.${className}{${serialized.styles}}`);
    state.registered[className] = serialized.styles;
};

const insertWithoutScoping = (state: CssState, serialized: SerializedStyles): void => {
    if (!didMarkNewStyle(state, serialized)) {
        return;
    }

    runStylis(state.sheet, serialized.styles);
};

const cssClassName = (state: CssState, args: CSSInterpolation[]): string => {
    const serialized = serializeStyles(args, state.registered);
    insertStyles(state, serialized);

    return getClassName(serialized);
};

const cxClassNames = (state: CssState, classNames: CxToken[]): string[] => {
    const tokens = classNames.filter(isNonEmptyString);
    const { rawClasses, registeredStyles } = partitionTokens(tokens, state.registered);

    if (registeredStyles.length < 2) {
        return tokens;
    }

    return [...rawClasses, cssClassName(state, [registeredStyles.join("")])];
};

const createCss = (): Css => {
    const state: CssState = { sheet: new StyleSheet(), inserted: new Set(), registered: {} };

    return {
        css: (...args) => cssClassName(state, args),
        cx: (...classNames) => cxClassNames(state, classNames),
        injectGlobal: (...args) => {
            insertWithoutScoping(state, serializeStyles(args, state.registered));
        },
    };
};

export { removeLabel, createCss, type Css };
