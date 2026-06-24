import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { StyleSheet } from "./stylesheet.js";
import { escapeNamedColors, removeLabel, restoreNamedColors } from "./stylis-plugins.js";

export type CssOptions = {
    key: string;
};

type CxToken = string | boolean | undefined | null;

type Cache = {
    key: string;
    sheet: StyleSheet;
    inserted: Set<string>;
    registered: RegisteredCache;
};

export type Css = {
    css: (...args: CSSInterpolation[]) => string;
    cx: (...classNames: CxToken[]) => string[];
    injectGlobal: (...args: CSSInterpolation[]) => void;
    getRegisteredStyles: (className: string) => string | undefined;
};

const createCache = ({ key }: CssOptions): Cache => ({
    key,
    sheet: new StyleSheet(),
    inserted: new Set<string>(),
    registered: {},
});

export const createInstance = (options: CssOptions): Css => {
    const cache = createCache(options);

    const runStylis = (input: string): void => {
        stylisSerialize(
            compile(escapeNamedColors(input)),
            middleware([
                removeLabel,
                stringify,
                rulesheet((rule) => {
                    cache.sheet.insert(restoreNamedColors(rule));
                }),
            ]),
        );
    };

    const serialize = (args: CSSInterpolation[]): SerializedStyles => serializeStyles(args, cache.registered);
    const classNameFor = (serialized: SerializedStyles): string => `${cache.key}-${serialized.name}`;

    const insertStyles = (serialized: SerializedStyles): void => {
        if (cache.inserted.has(serialized.name)) return;
        cache.inserted.add(serialized.name);

        const className = classNameFor(serialized);
        runStylis(`.${className}{${serialized.styles}}`);
        cache.registered[className] = serialized.styles;
    };

    const insertWithoutScoping = (serialized: SerializedStyles): void => {
        if (cache.inserted.has(serialized.name)) return;
        cache.inserted.add(serialized.name);

        runStylis(serialized.styles);
    };

    const getRegisteredStyles = (className: string): string | undefined => cache.registered[className];

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
            const styles = getRegisteredStyles(token);
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

    return { css, cx, injectGlobal, getRegisteredStyles };
};
