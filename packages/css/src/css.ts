import type { CSSInterpolation } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { compile, type Middleware, middleware, rulesheet, serialize, stringify } from "stylis";
import { getCache, getStylesheet } from "./cache.js";

const AT_RULE_KEYWORDS = new Set([
    "binding-set",
    "charset",
    "define-color",
    "document",
    "font-face",
    "import",
    "keyframes",
    "media",
    "namespace",
    "page",
    "supports",
]);
const AT_IDENTIFIER_PATTERN = /@([A-Za-z_][\w-]*)/g;
const NAMED_COLOR_TOKEN = "gtkx-named-color__";
const NAMED_COLOR_TOKEN_PATTERN = new RegExp(`${NAMED_COLOR_TOKEN}([\\w-]+)`, "g");

/**
 * Shields GTK named-color references (`@theme_bg_color`, `@accent_bg_color`,
 * …) from stylis, which parses any `@identifier` as a CSS at-rule and drops
 * the declaration carrying it. Real at-rules (`@keyframes`, `@media`,
 * GTK's `@define-color`, …) pass through untouched.
 */
const escapeNamedColors = (input: string): string =>
    input.replace(AT_IDENTIFIER_PATTERN, (match, name: string) =>
        AT_RULE_KEYWORDS.has(name) ? match : `${NAMED_COLOR_TOKEN}${name}`,
    );

const restoreNamedColors = (rule: string): string => rule.replace(NAMED_COLOR_TOKEN_PATTERN, "@$1");

const LABEL_DECL_FIRST_CHAR = 108;
const LABEL_DECL_THIRD_CHAR = 98;

/**
 * Strips Emotion's `label:` markers before rules reach GTK's CSS parser.
 *
 * `@emotion/serialize` leaves `label:` declarations in the serialized styles by
 * design and relies on a downstream plugin to remove them; GTK's parser would
 * otherwise reject the unknown declaration. Mirrors `@emotion/cache`'s internal
 * `removeLabel`.
 */
const removeLabel: Middleware = (element) => {
    if (
        element.type === "decl" &&
        element.value.charCodeAt(0) === LABEL_DECL_FIRST_CHAR &&
        element.value.charCodeAt(2) === LABEL_DECL_THIRD_CHAR
    ) {
        element.return = "";
        element.value = "";
    }
};

const insertRules = (input: string): void => {
    const stylesheet = getStylesheet();
    serialize(
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

/**
 * Creates a CSS class from style definitions.
 *
 * Uses Emotion's serializer for hashing and stylis for nested-rule
 * expansion, at-rule scoping, and selector compounding. Nested selectors
 * reference the parent class via `&`, matching Emotion / styled-components
 * semantics.
 *
 * @param args - CSS style definitions (objects, template literals, or interpolations)
 * @returns A unique class name to use with `cssClasses` prop
 *
 * @example
 * ```tsx
 * import { css } from "@gtkx/css";
 *
 * const buttonStyle = css({
 *   padding: "8px 16px",
 *   borderRadius: "4px",
 *   "&:hover": {
 *     backgroundColor: "@accent_bg_color",
 *   },
 * });
 *
 * <GtkButton cssClasses={[buttonStyle]} label="Styled Button" />
 * ```
 *
 * @example
 * ```tsx
 * // Template literal syntax
 * const labelStyle = css`
 *   font-size: 14px;
 *   color: @theme_text_color;
 * `;
 * ```
 *
 * @see {@link cx} for combining class names
 * @see {@link injectGlobal} for global styles
 */
export const css = (...args: CSSInterpolation[]): string => {
    const cache = getCache();
    const serialized = serializeStyles(args, cache.registered);
    const className = `${cache.key}-${serialized.name}`;

    if (cache.inserted[serialized.name] === undefined) {
        insertRules(`.${className}{${serialized.styles}}`);
        cache.inserted[serialized.name] = true;
        cache.registered[className] = serialized.styles;
    }

    return className;
};

/**
 * Combines class names into an array suitable for the `cssClasses` prop.
 *
 * Filters out falsy values, allowing conditional class application.
 *
 * Note: unlike `@emotion/css`'s `cx`, this does not merge cached styles into a
 * single class — GTK widgets accept an array via `cssClasses`, so we keep the
 * names separate. Use it the same way you would use `clsx` or `classnames`.
 *
 * @param classNames - Class names, booleans, undefined, or null values
 * @returns Array of valid class names
 *
 * @example
 * ```tsx
 * import { css, cx } from "@gtkx/css";
 *
 * const base = css({ padding: "8px" });
 * const active = css({ backgroundColor: "@accent_bg_color" });
 *
 * <GtkButton
 *   cssClasses={cx(base, isActive && active, "custom-class")}
 *   label="Button"
 * />
 * ```
 */
export const cx = (...classNames: (string | boolean | undefined | null)[]): string[] =>
    classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0);

/**
 * Injects global CSS styles without a wrapping class.
 *
 * Use for application-wide styles, CSS variables, or styling native GTK widgets.
 *
 * @param args - CSS style definitions
 *
 * @example
 * ```tsx
 * import { injectGlobal } from "@gtkx/css";
 *
 * injectGlobal`
 *   window {
 *     background-color: @theme_bg_color;
 *   }
 *
 *   .title-1 {
 *     font-size: 24px;
 *     font-weight: bold;
 *   }
 * `;
 * ```
 *
 * @see {@link css} for scoped class-based styles
 */
export const injectGlobal = (...args: CSSInterpolation[]): void => {
    const cache = getCache();
    const serialized = serializeStyles(args, cache.registered);
    const insertedKey = `global-${serialized.name}`;

    if (cache.inserted[insertedKey] === undefined) {
        insertRules(serialized.styles);
        cache.inserted[insertedKey] = true;
    }
};
