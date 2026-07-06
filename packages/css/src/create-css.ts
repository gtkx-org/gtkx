import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import type { Element } from "stylis";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { escapeNamedColors, restoreNamedColors } from "./named-colors.js";
import { StyleSheet } from "./stylesheet.js";

const KEY = "gtkx";

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

type CxToken = string | boolean | undefined | null;

export type Css = {
    css: (...args: CSSInterpolation[]) => string;
    cx: (...classNames: CxToken[]) => string[];
    injectGlobal: (...args: CSSInterpolation[]) => void;
};

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

const classNameFor = (serialized: SerializedStyles): string => `${KEY}-${serialized.name}`;

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

export const createCss = (): Css => {
    const sheet = new StyleSheet();
    const inserted = new Set<string>();
    const registered: RegisteredCache = {};

    const serialize = (args: CSSInterpolation[]): SerializedStyles => serializeStyles(args, registered);

    const insertStyles = (serialized: SerializedStyles): void => {
        if (inserted.has(serialized.name)) return;
        inserted.add(serialized.name);
        const className = classNameFor(serialized);
        runStylis(sheet, `.${className}{${serialized.styles}}`);
        registered[className] = serialized.styles;
    };

    const insertWithoutScoping = (serialized: SerializedStyles): void => {
        if (inserted.has(serialized.name)) return;
        inserted.add(serialized.name);
        runStylis(sheet, serialized.styles);
    };

    const css = (...args: CSSInterpolation[]): string => {
        const serialized = serialize(args);
        insertStyles(serialized);
        return classNameFor(serialized);
    };

    const cx = (...classNames: CxToken[]): string[] => {
        const tokens = classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0);

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

        if (registeredStyles.length < 2) return tokens;

        return [...rawClasses, css(registeredStyles.join(""))];
    };

    const injectGlobal = (...args: CSSInterpolation[]): void => {
        insertWithoutScoping(serialize(args));
    };

    return { css, cx, injectGlobal };
};
