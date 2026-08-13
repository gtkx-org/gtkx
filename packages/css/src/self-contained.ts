type Scan = { stack: string[]; hasPendingPrelude: boolean; isAtRule: boolean };

const COMMENT = String.raw`/\*.*?\*/`;
const DOUBLE_STRING = String.raw`"(?:\\.|[^"\\\n])*"`;
const SINGLE_STRING = String.raw`'(?:\\.|[^'\\\n])*'`;
const ESCAPE = String.raw`\\.`;
const UNQUOTED_URL = String.raw`url\((?!\s*["'])(?:\\.|[^\\)])*\)`;
const NAME = String.raw`[\w-]+`;
const BRACKET = String.raw`[()[\]{}]`;
const UNCLOSED = String.raw`/\*|["']`;
const OTHER = String.raw`\S`;
const TOKENS = [COMMENT, DOUBLE_STRING, SINGLE_STRING, ESCAPE, UNQUOTED_URL, NAME, BRACKET, UNCLOSED, OTHER];
const TOKEN = new RegExp(TOKENS.join("|"), "gis");
const CLOSER_BY_OPENER = new Map([["(", ")"], ["[", "]"], ["{", "}"]]);
const CLOSERS = new Set(CLOSER_BY_OPENER.values());
const UNCLOSED_TOKENS = new Set(["/*", '"', "'"]);
const BLOCK_CLOSER = "}";
const STATEMENT_END = ";";
const AT_RULE_START = "@";
const COMMENT_START = "/*";

const isBracket = (token: string): boolean => CLOSER_BY_OPENER.has(token) || CLOSERS.has(token);

const didTakeBracket = (scan: Scan, token: string): boolean => {
    const closer = CLOSER_BY_OPENER.get(token);

    if (closer !== undefined) {
        scan.stack.push(closer);
        scan.hasPendingPrelude = true;

        return true;
    }

    if (scan.stack.pop() !== token) {
        return false;
    }

    if (token === BLOCK_CLOSER && scan.stack.length === 0) {
        scan.hasPendingPrelude = false;
        scan.isAtRule = false;
    } else {
        scan.hasPendingPrelude = true;
    }

    return true;
};

const didTakeStatementEnd = (scan: Scan): boolean => {
    if (!scan.isAtRule) {
        return false;
    }

    scan.hasPendingPrelude = false;
    scan.isAtRule = false;

    return true;
};

const takePrelude = (scan: Scan, token: string): void => {
    scan.isAtRule ||= token === AT_RULE_START && !scan.hasPendingPrelude;
    scan.hasPendingPrelude = true;
};

const didTakeToken = (scan: Scan, token: string): boolean => {
    if (UNCLOSED_TOKENS.has(token)) {
        return false;
    }

    if (isBracket(token)) {
        return didTakeBracket(scan, token);
    }

    if (scan.stack.length > 0 || token.startsWith(COMMENT_START)) {
        return true;
    }

    if (token === STATEMENT_END) {
        return didTakeStatementEnd(scan);
    }

    takePrelude(scan, token);

    return true;
};

const isSelfContained = (rule: string): boolean => {
    const scan: Scan = { stack: [], hasPendingPrelude: false, isAtRule: false };

    for (const [token] of rule.matchAll(TOKEN)) {
        if (!didTakeToken(scan, token)) {
            return false;
        }
    }

    return scan.stack.length === 0 && !scan.hasPendingPrelude;
};

export { isSelfContained };
