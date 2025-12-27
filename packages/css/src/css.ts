import type { CSSInterpolation } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { getGtkCache } from "./cache.js";

type CSSClassName = string & { __brand: "css" };

function expandNestedRules(styles: string, className: string): string {
    const selector = `.${className}`;
    const expandedStyles = styles.replace(/&/g, selector);

    const rules: string[] = [];
    let currentRule = "";
    let braceDepth = 0;
    let inSelector = false;
    let mainProperties = "";

    for (let i = 0; i < expandedStyles.length; i++) {
        const char = expandedStyles[i];

        if (char === "{") {
            braceDepth++;
            if (braceDepth === 1 && currentRule.includes(selector)) {
                inSelector = true;
                currentRule += char;
            } else {
                currentRule += char;
            }
        } else if (char === "}") {
            braceDepth--;
            currentRule += char;
            if (braceDepth === 0 && inSelector) {
                rules.push(currentRule.trim());
                currentRule = "";
                inSelector = false;
            }
        } else if (braceDepth === 0 && char === "." && expandedStyles.slice(i).startsWith(selector)) {
            if (mainProperties.length > 0 || currentRule.length > 0) {
                mainProperties += currentRule;
                currentRule = "";
            }
            currentRule += char;
        } else {
            currentRule += char;
        }
    }

    if (currentRule.trim()) {
        mainProperties += currentRule;
    }

    const allRules: string[] = [];
    if (mainProperties.trim()) {
        allRules.push(`${selector}{${mainProperties.trim()}}`);
    }
    allRules.push(...rules);

    return allRules.join("\n");
}

export const css = (...args: CSSInterpolation[]): CSSClassName => {
    const cache = getGtkCache();
    const serialized = serializeStyles(args, cache.registered);

    const className = `${cache.key}-${serialized.name}`;

    if (cache.inserted[serialized.name] === undefined) {
        const cssRule = expandNestedRules(serialized.styles, className);
        cache.sheet.insert(cssRule);
        cache.inserted[serialized.name] = serialized.styles;
        cache.registered[className] = serialized.styles;
    }

    return className as CSSClassName;
};

export const cx = (...classNames: (string | boolean | undefined | null)[]): string =>
    classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0).join(" ");

export const injectGlobal = (...args: CSSInterpolation[]): void => {
    const cache = getGtkCache();
    const serialized = serializeStyles(args, cache.registered);

    if (cache.inserted[`global-${serialized.name}`] === undefined) {
        cache.sheet.insert(serialized.styles);
        cache.inserted[`global-${serialized.name}`] = serialized.styles;
    }
};
