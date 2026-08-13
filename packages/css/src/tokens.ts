type Step = { index: number; reason: string | null };

const UNTERMINATED = "leaves a string, comment or url unterminated";
const NEWLINE_IN_STRING = "carries a newline inside a string";
const ESCAPE = "\\";
const NEWLINE = "\n";
const CLOSE_PAREN = ")";
const COMMENT_OPEN = "/*";
const COMMENT_CLOSE = "*/";
const URL_OPEN = "url(";
const QUOTES = new Set(['"', "'"]);
const URL_TOKEN = /url\(/iy;
const QUOTED_URL = /url\([\t\n\f\r ]*["']/iy;

const hasMatchAt = (pattern: RegExp, text: string, index: number): boolean => {
    pattern.lastIndex = index;

    return pattern.test(text);
};

const isUrlStart = (text: string, index: number): boolean =>
    hasMatchAt(URL_TOKEN, text, index) && !hasMatchAt(QUOTED_URL, text, index);

const took = (index: number): Step => ({ index, reason: null });
const broke = (index: number, reason: string): Step => ({ index, reason });
const stepped = (text: string, index: number): number => index + (text.charAt(index) === ESCAPE ? 2 : 1);

const endOfString = (text: string, index: number, quote: string): Step | null => {
    const char = text.charAt(index);

    if (char === quote) {
        return took(index + 1);
    }

    return char === NEWLINE ? broke(index + 1, NEWLINE_IN_STRING) : null;
};

const readString = (text: string, start: number, quote: string): Step => {
    let index = start;

    while (index < text.length) {
        const end = endOfString(text, index, quote);

        if (end !== null) {
            return end;
        }

        index = stepped(text, index);
    }

    return broke(index, UNTERMINATED);
};

const readComment = (text: string, start: number): Step => {
    const end = text.indexOf(COMMENT_CLOSE, start);

    return end === -1 ? broke(text.length, UNTERMINATED) : took(end + COMMENT_CLOSE.length);
};

const readUrl = (text: string, start: number): Step => {
    let index = start;

    while (index < text.length) {
        if (text.charAt(index) === CLOSE_PAREN) {
            return took(index + 1);
        }

        index = stepped(text, index);
    }

    return broke(index, UNTERMINATED);
};

const readNext = (text: string, index: number): Step => {
    const char = text.charAt(index);

    if (char === ESCAPE) {
        return took(index + 2);
    }

    if (QUOTES.has(char)) {
        return readString(text, index + 1, char);
    }

    if (text.startsWith(COMMENT_OPEN, index)) {
        return readComment(text, index + COMMENT_OPEN.length);
    }

    return isUrlStart(text, index) ? readUrl(text, index + URL_OPEN.length) : took(index + 1);
};

const brokenToken = (text: string): string | null => {
    let index = 0;

    while (index < text.length) {
        const step = readNext(text, index);

        if (step.reason !== null) {
            return step.reason;
        }

        index = step.index;
    }

    return null;
};

export { brokenToken };
