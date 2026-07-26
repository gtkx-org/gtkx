export type Token = { t: string; c?: string };

const KEYWORDS = new Set([
    "import",
    "from",
    "export",
    "default",
    "function",
    "return",
    "const",
    "let",
    "var",
    "async",
    "await",
    "new",
    "if",
    "else",
    "for",
    "of",
    "in",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "class",
    "extends",
    "implements",
    "interface",
    "type",
    "enum",
    "typeof",
    "instanceof",
    "as",
    "yield",
    "true",
    "false",
    "null",
    "undefined",
    "void",
    "this",
]);

const isIdentStart = (ch: string): boolean => /[A-Za-z_$]/.test(ch);
const isIdent = (ch: string): boolean => /[A-Za-z0-9_$]/.test(ch);

type Match = [Token[], number];

const charAt = (line: string, i: number): string => line[i] ?? "";

const scanWhile = (line: string, start: number, predicate: (ch: string) => boolean): number => {
    const n = line.length;
    let j = start;
    while (j < n && predicate(line[j])) j++;
    return j;
};

const scanString = (line: string, start: number, quote: string): Match => {
    const n = line.length;
    let j = start + 1;
    while (j < n && line[j] !== quote) {
        if (line[j] === "\\") j++;
        j++;
    }
    return [[{ t: line.slice(start, Math.min(j + 1, n)), c: "str" }], j + 1];
};

const scanTag = (line: string, start: number, next: string): Match => {
    const isClose = next === "/";
    const toks: Token[] = isClose ? [{ t: "</", c: "punct" }] : [{ t: "<", c: "punct" }];
    const nameStart = isClose ? start + 2 : start + 1;
    const j = scanWhile(line, nameStart, (ch) => isIdent(ch) || ch === ".");
    const name = line.slice(nameStart, j);
    if (name) toks.push({ t: name, c: "tag" });
    return [toks, j];
};

const scanIdent = (line: string, start: number): Match => {
    const j = scanWhile(line, start, isIdent);
    const word = line.slice(start, j);
    const k = scanWhile(line, j, (ch) => ch === " ");
    if (KEYWORDS.has(word)) return [[{ t: word, c: "kw" }], j];
    if (line[k] === "(") return [[{ t: word, c: "fn" }], j];
    return [[{ t: word }], j];
};

const isTagStart = (ch: string, next: string): boolean => ch === "<" && (next === "/" || isIdentStart(next));

const isQuote = (ch: string): boolean => ch === '"' || ch === "'" || ch === "`";

const matchSlash = (line: string, i: number, next: string): Match | null => {
    if (next === "/") return [[{ t: line.slice(i), c: "comment" }], line.length];
    if (next === ">") return [[{ t: "/>", c: "punct" }], i + 2];
    return null;
};

const matchAt = (line: string, i: number): Match | null => {
    const ch = line[i];
    const next = charAt(line, i + 1);
    if (ch === "/") return matchSlash(line, i, next);
    if (isQuote(ch)) return scanString(line, i, ch);
    if (isTagStart(ch, next)) return scanTag(line, i, next);
    if (ch === ">") return [[{ t: ">", c: "punct" }], i + 1];
    if (isIdentStart(ch)) return scanIdent(line, i);
    return null;
};

const tokenizeLine = (line: string): Token[] => {
    const toks: Token[] = [];
    const n = line.length;
    let i = 0;
    let plain = "";
    const flush = (): void => {
        if (plain) {
            toks.push({ t: plain });
            plain = "";
        }
    };

    while (i < n) {
        const match = matchAt(line, i);
        if (match) {
            flush();
            toks.push(...match[0]);
            i = match[1];
        } else {
            plain += line[i];
            i++;
        }
    }
    flush();
    return toks;
};

export const tokenizeCode = (code: string): Token[][] => String(code).replace(/\n$/, "").split("\n").map(tokenizeLine);
