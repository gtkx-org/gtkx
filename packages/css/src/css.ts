import type { CSSInterpolation } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { getGtkCache } from "./cache.js";

type CSSClassName = string & { __brand: "css" };

/**
 * Creates a CSS class from styles and injects them into GTK.
 * Works like Emotion's css function but outputs to GTK's CssProvider.
 *
 * @example
 * ```tsx
 * const buttonStyle = css`
 *   background: @theme_bg_color;
 *   padding: 12px;
 *   border-radius: 6px;
 * `;
 *
 * <Button cssClasses={[buttonStyle]}>Styled Button</Button>
 * ```
 */
export const css = (...args: CSSInterpolation[]): CSSClassName => {
    const cache = getGtkCache();
    const serialized = serializeStyles(args, cache.registered);

    const className = `${cache.key}-${serialized.name}`;

    if (cache.inserted[serialized.name] === undefined) {
        const cssRule = `.${className}{${serialized.styles}}`;
        cache.sheet.insert(cssRule);
        cache.inserted[serialized.name] = serialized.styles;
    }

    return className as CSSClassName;
};

/**
 * Merges multiple class names, filtering out falsy values.
 *
 * @example
 * ```tsx
 * const combined = cx(baseStyle, isActive && activeStyle, 'manual-class');
 * <Button cssClasses={[combined]}>Button</Button>
 * ```
 */
export const cx = (...classNames: (string | boolean | undefined | null)[]): string =>
    classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0).join(" ");

/**
 * Injects global CSS styles.
 * Note: In GTK, these styles apply to all widgets on the display.
 *
 * @example
 * ```tsx
 * injectGlobal`
 *   window {
 *     background: @theme_bg_color;
 *   }
 *   button {
 *     border-radius: 6px;
 *   }
 * `;
 * ```
 */
export const injectGlobal = (...args: CSSInterpolation[]): void => {
    const cache = getGtkCache();
    const serialized = serializeStyles(args, cache.registered);

    if (cache.inserted[`global-${serialized.name}`] === undefined) {
        cache.sheet.insert(serialized.styles);
        cache.inserted[`global-${serialized.name}`] = serialized.styles;
    }
};
