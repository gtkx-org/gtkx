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
    const n = line.length;
    const toks: Token[] = next === "/" ? [{ t: "</", c: "punct" }] : [{ t: "<", c: "punct" }];
    let j = next === "/" ? start + 2 : start + 1;
    const nameStart = j;
    while (j < n && (isIdent(line[j]) || line[j] === ".")) j++;
    const name = line.slice(nameStart, j);
    if (name) toks.push({ t: name, c: "tag" });
    return [toks, j];
};

const scanIdent = (line: string, start: number): Match => {
    const n = line.length;
    let j = start;
    while (j < n && isIdent(line[j])) j++;
    const word = line.slice(start, j);
    let k = j;
    while (k < n && line[k] === " ") k++;
    if (KEYWORDS.has(word)) return [[{ t: word, c: "kw" }], j];
    if (line[k] === "(") return [[{ t: word, c: "fn" }], j];
    return [[{ t: word }], j];
};

const isTagStart = (ch: string, next: string): boolean => ch === "<" && (next === "/" || isIdentStart(next));

const matchAt = (line: string, i: number): Match | null => {
    const n = line.length;
    const ch = line[i];
    const next = line[i + 1] ?? "";
    if (ch === "/" && next === "/") return [[{ t: line.slice(i), c: "comment" }], n];
    if (ch === '"' || ch === "'" || ch === "`") return scanString(line, i, ch);
    if (isTagStart(ch, next)) return scanTag(line, i, next);
    if (ch === "/" && next === ">") return [[{ t: "/>", c: "punct" }], i + 2];
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
