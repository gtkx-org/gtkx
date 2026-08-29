import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { eachRule, terminateDeclarations } from "./serialize-rule.js";
import { StyleSheet } from "./stylesheet.js";

/** A `cx` argument: a non-empty class name, or a boolean or nullish value that is dropped. */
type CxToken = string | boolean | undefined | null;

/** The `css`, `cx` and `injectGlobal` helpers bound to one GTK4 stylesheet and its cache of inserted styles. */
type Css = {
    /**
     * Serializes the given style interpolations, inserts the resulting rules into the stylesheet, and
     * returns the generated GTK4 CSS class name.
     */
    css: (...args: CSSInterpolation[]) => string;
    /**
     * Filters out falsy tokens and returns the remaining class names, collapsing two or more
     * GTKX-generated classes into one merged class where later styles win.
     */
    cx: (...classNames: CxToken[]) => string[];
    /** Serializes and inserts the given styles into the stylesheet globally, unscoped by any class. */
    injectGlobal: (...args: CSSInterpolation[]) => void;
};

type TokenPartition = { rawClasses: string[]; registeredStyles: string[] };
type CssState = { sheet: StyleSheet; inserted: Set<string>; registered: RegisteredCache };

const KEY = "gtkx";

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
    const styles = terminateDeclarations(serialized.styles);

    eachRule(`.${className}{${styles}}`, (rule) => {
        state.sheet.insert(rule);
    });

    state.registered[className] = styles;
};

const insertWithoutScoping = (state: CssState, serialized: SerializedStyles): void => {
    if (!didMarkNewStyle(state, serialized)) {
        return;
    }

    eachRule(serialized.styles, (rule) => {
        state.sheet.insert(rule);
    });
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

export { createCss, type Css };
