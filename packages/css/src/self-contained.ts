const COMMENT = String.raw`/\*.*?\*/`;
const DOUBLE_STRING = String.raw`"(?:\\.|[^"\\\n])*"`;
const SINGLE_STRING = String.raw`'(?:\\.|[^'\\\n])*'`;
const ESCAPE = String.raw`\\.`;
const UNQUOTED_URL = String.raw`url\((?!\s*["'])(?:\\.|[^\\)])*\)`;
const NAME = String.raw`[\w-]+`;
const BRACKET = String.raw`[()[\]{}]`;
const UNCLOSED = String.raw`/\*|["']`;
const TOKENS = [COMMENT, DOUBLE_STRING, SINGLE_STRING, ESCAPE, UNQUOTED_URL, NAME, BRACKET, UNCLOSED];
const TOKEN = new RegExp(TOKENS.join("|"), "gis");
const CLOSER_BY_OPENER: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSERS = new Set(Object.values(CLOSER_BY_OPENER));
const UNCLOSED_TOKENS = new Set(["/*", '"', "'"]);

const didTakeBracket = (stack: string[], token: string): boolean => {
    const closer = CLOSER_BY_OPENER[token];

    if (closer !== undefined) {
        stack.push(closer);

        return true;
    }

    return CLOSERS.has(token) ? stack.pop() === token : true;
};

const isSelfContained = (rule: string): boolean => {
    const stack: string[] = [];

    for (const [token] of rule.matchAll(TOKEN)) {
        if (UNCLOSED_TOKENS.has(token) || !didTakeBracket(stack, token)) {
            return false;
        }
    }

    return stack.length === 0;
};

export { isSelfContained };
