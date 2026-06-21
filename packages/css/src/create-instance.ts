import type { CSSInterpolation, RegisteredCache, SerializedStyles } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { compile, middleware, rulesheet, stringify, serialize as stylisSerialize } from "stylis";
import { Stylesheet } from "./stylesheet.js";
import { escapeNamedColors, removeLabel, restoreNamedColors } from "./stylis-extensions.js";

/**
 * Options for {@link createInstance}.
 */
export type InstanceOptions = {
    /**
     * The prefix used for every generated class name (for example `gtkx`).
     */
    key: string;
};

type CxToken = string | boolean | undefined | null;

/**
 * A self-contained CSS-in-JS bundle. Each instance owns its own dedup set,
 * registered-style map, and GTK stylesheet sink, so instances never share
 * mutable state.
 */
export type Instance = {
    /**
     * Serializes the given style interpolations and inserts them as a scoped GTK CSS rule,
     * returning the generated class name. Identical styles return the same class name and
     * are inserted only once.
     *
     * @param args - The style interpolations to serialize.
     * @returns The generated class name.
     */
    css: (...args: CSSInterpolation[]) => string;
    /**
     * Combines class names for GTK's `cssClasses` array prop, dropping falsy entries.
     *
     * When two or more arguments are class names produced by {@link Instance.css}, their
     * registered styles are merged and re-serialized into a single override class so that
     * later styles win over earlier ones for any conflicting property. Raw class names and a
     * lone registered class are passed through unchanged.
     *
     * @param classNames - The class-name tokens to combine.
     * @returns The resolved array of class names.
     */
    cx: (...classNames: CxToken[]) => string[];
    /**
     * Serializes the given style interpolations and inserts them as unscoped, global GTK CSS.
     * Identical styles are inserted only once.
     *
     * @param args - The style interpolations to serialize.
     */
    injectGlobal: (...args: CSSInterpolation[]) => void;
    /**
     * Looks up the serialized style text recorded for a registered class name, if any.
     *
     * @param className - The class name to resolve registered styles for.
     * @returns The registered style text, or `undefined` when the class is not registered.
     */
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

/**
 * Creates a self-contained CSS-in-JS instance closed over its own dedup set,
 * registered-style map, and GTK {@link Stylesheet} sink.
 *
 * @param options - The instance options, including the class-name key.
 * @returns A bundle exposing `css`, `cx`, `injectGlobal`, and `registeredStylesFor`.
 */
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
