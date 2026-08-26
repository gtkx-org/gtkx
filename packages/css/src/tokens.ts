type Scan = { index: number; quote: string | null; broken: boolean };

const NEWLINE_IN_STRING = "carries a newline inside a string";
const ESCAPE = "\\";
const CRLF = "\r\n";
const QUOTES = new Set(['"', "'"]);
const NEWLINES = new Set(["\n", "\r", "\f"]);
const AFTER_ESCAPE = 2;
const AFTER_ESCAPED_CRLF = 3;

const skipEscape = (rule: string, index: number): number =>
    index + (rule.startsWith(CRLF, index + 1) ? AFTER_ESCAPED_CRLF : AFTER_ESCAPE);

const stepped = (rule: string, scan: Scan): Scan => {
    const char = rule.charAt(scan.index);

    if (char === ESCAPE) {
        return { index: skipEscape(rule, scan.index), quote: scan.quote, broken: false };
    }

    if (scan.quote === null) {
        return { index: scan.index + 1, quote: QUOTES.has(char) ? char : null, broken: false };
    }

    return {
        index: scan.index + 1,
        quote: char === scan.quote ? null : scan.quote,
        broken: NEWLINES.has(char),
    };
};

const hasNewlineInString = (rule: string): boolean => {
    let scan: Scan = { index: 0, quote: null, broken: false };

    while (scan.index < rule.length) {
        scan = stepped(rule, scan);

        if (scan.broken) {
            return true;
        }
    }

    return false;
};

export { hasNewlineInString, NEWLINE_IN_STRING };
