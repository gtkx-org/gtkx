import type { CSSObject } from "@emotion/serialize";
import { serializeStyles } from "@emotion/serialize";
import { createLogger } from "@gtkx/utils";
import { hasNul, NUL_REASON, printableRule } from "./rule-text.js";
import { eachRule, terminateDeclarations } from "./serialize-rule.js";

type Scope = { className: string; rules: string[] };

const log = createLogger("css");
const ESCAPE_REASON = "does not start from the widget it belongs to";
const NAME_CHAR = /[\w-]/;

const isScoped = (rule: string, className: string): boolean => {
    const prefix = `.${className}`;

    if (!rule.startsWith(prefix)) {
        return false;
    }

    const next = rule.charAt(prefix.length);

    return next !== "" && !NAME_CHAR.test(next);
};

const unusableReason = (rule: string, className: string): string | null => {
    if (hasNul(rule)) {
        return NUL_REASON;
    }

    return isScoped(rule, className) ? null : ESCAPE_REASON;
};

const collect = (scope: Scope, rule: string): void => {
    const reason = unusableReason(rule, scope.className);

    if (reason !== null) {
        log.warn(`Dropped a style rule that ${reason}: ${printableRule(rule)}`);

        return;
    }

    scope.rules.push(rule);
};

const scopedRule = (className: string, style: object): string => {
    const declarations = terminateDeclarations(serializeStyles([style as CSSObject], {}).styles);

    if (declarations.length === 0) {
        return "";
    }

    const scope: Scope = { className, rules: [] };

    eachRule(`.${className}{${declarations}}`, (rule) => {
        collect(scope, rule);
    });

    return scope.rules.join("");
};

export { scopedRule };
