import type { McpSettings } from "@gtkx/config/internal";
import type { Tool } from "./tool.js";

const NEGATION_PREFIX = "!";
const SPECIAL_CHARACTERS = /[.+?^${}()|[\]\\]/g;

const escapeLiteral = (value: string): string => value.replaceAll(SPECIAL_CHARACTERS, String.raw`\$&`);

const patternToRegExp = (pattern: string): RegExp =>
    new RegExp(`^${pattern.split("*").map((part) => escapeLiteral(part)).join(".*")}$`);

const matchingNames = (tools: Tool[], pattern: string): string[] => {
    const expression = patternToRegExp(pattern);

    return tools.filter((tool) => expression.test(tool.name)).map((tool) => tool.name);
};

const applyPattern = (selected: Set<string>, tools: Tool[], pattern: string): void => {
    const isNegated = pattern.startsWith(NEGATION_PREFIX);
    const names = matchingNames(tools, isNegated ? pattern.slice(NEGATION_PREFIX.length) : pattern);

    for (const name of names) {
        if (isNegated) {
            selected.delete(name);
        } else {
            selected.add(name);
        }
    }
};

const selectNames = (tools: Tool[], patterns: string[]): Set<string> => {
    const isSubtractive = patterns.every((pattern) => pattern.startsWith(NEGATION_PREFIX));
    const selected: Set<string> = new Set(isSubtractive ? tools.map((tool) => tool.name) : []);

    for (const pattern of patterns) {
        applyPattern(selected, tools, pattern);
    }

    return selected;
};

const selectTools = (tools: Tool[], settings: McpSettings): Tool[] => {
    const allowed = settings.isReadOnly ? tools.filter((tool) => tool.kind === "readOnly") : tools;

    if (settings.tools.length === 0) {
        return allowed;
    }

    const selected = selectNames(allowed, settings.tools);

    return allowed.filter((tool) => selected.has(tool.name));
};

export { selectTools };
