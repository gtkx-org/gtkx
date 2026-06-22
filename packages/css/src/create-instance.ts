import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { Stylesheet } from "./stylesheet.js";
import { escapeNamedColors, removeLabel, restoreNamedColors } from "./stylis-extensions.js";

export type InstanceOptions = {
    key: string;
};

type CxToken = string | boolean | undefined | null;

export type Instance = {
    css: (...args: CSSInterpolation[]) => string;
    cx: (...classNames: CxToken[]) => string[];
    injectGlobal: (...args: CSSInterpolation[]) => void;
    registeredStylesFor: (className: string) => string | undefined;
};

const makeInsertRules =
    (stylesheet: Stylesheet) =>
    (input: string): void => {
        stylisSerialize(
            compile(escapeNamedColors(input)),
            middleware([
                removeLabel,
                stringify,
                rulesheet((rule) => {
                    stylesheet.insert(restoreNamedColors(rule));
                }),
            ]),
        );
    };

const makeInsert =
    (
        inserted: Set<string>,
        registered: RegisteredCache,
        insertRules: (input: string) => void,
        classNameFor: (serialized: SerializedStyles) => string,
    ) =>
    (serialized: SerializedStyles, options: { scoped: boolean }): void => {
        if (inserted.has(serialized.name)) return;
        inserted.add(serialized.name);

        if (options.scoped) {
            const className = classNameFor(serialized);
            insertRules(`.${className}{${serialized.styles}}`);
            registered[className] = serialized.styles;
        } else {
            insertRules(serialized.styles);
        }
    };

const makeCx =
    (css: (...args: CSSInterpolation[]) => string, registeredStylesFor: (className: string) => string | undefined) =>
    (...classNames: CxToken[]): string[] => {
        const tokens = classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0);

        const rawClasses: string[] = [];
        const registeredStyles: string[] = [];
        for (const token of tokens) {
            const styles = registeredStylesFor(token);
            if (styles === undefined) {
                rawClasses.push(token);
            } else {
                registeredStyles.push(styles);
            }
        }

        if (registeredStyles.length < 2) return tokens;

        return [...rawClasses, css(registeredStyles.join(""))];
    };

export const createInstance = ({ key }: InstanceOptions): Instance => {
    const inserted = new Set<string>();
    const registered: RegisteredCache = {};
    const stylesheet = new Stylesheet();

    const insertRules = makeInsertRules(stylesheet);
    const serialize = (args: CSSInterpolation[]): SerializedStyles => serializeStyles(args, registered);
    const classNameFor = (serialized: SerializedStyles): string => `${key}-${serialized.name}`;
    const insert = makeInsert(inserted, registered, insertRules, classNameFor);

    const css = (...args: CSSInterpolation[]): string => {
        const serialized = serialize(args);
        insert(serialized, { scoped: true });
        return classNameFor(serialized);
    };

    const registeredStylesFor = (className: string): string | undefined => registered[className];
    const cx = makeCx(css, registeredStylesFor);

    const injectGlobal = (...args: CSSInterpolation[]): void => {
        insert(serialize(args), { scoped: false });
    };

    return { css, cx, injectGlobal, registeredStylesFor };
};
