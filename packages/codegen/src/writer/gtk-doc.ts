import { camelCase } from "@gtkx/utils";

const CONSTANT_MAP: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };
const CALLABLE_LINK_KINDS: Set<string> = new Set(["method", "func", "ctor", "vfunc", "id"]);
const SENTINEL = String.fromCodePoint(0xE0_00);
const CODE_BLOCK_OPEN = "|[";
const CODE_BLOCK_CLOSE = "]|";
const CODE_LANGUAGE_PATTERN = /^\s*<!--\s*language="([^"]*)"\s*-->/;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const LINK_PATTERN = /\[(\w+)@([\w.:%#-]+)\]/g;
const CONSTANT_PATTERN = /(?<![\w\\])%(\w+)/g;
const ESCAPED_CONSTANT_PATTERN = /\\%/g;
const TYPE_REF_PATTERN = /(?<!\w)#(\w+)(::[\w-]+|:[\w-]+)?/g;
const PARAM_REF_PATTERN = /(?<!\w)@(\w+)/g;
const FUNCTION_REF_PATTERN = /\b([a-z_][a-z0-9_]*)\(\)/g;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const DOCBOOK_TAG_PATTERN = /<\/?(?:itemizedlist|listitem|para|literal|link|informalexample|programlisting)[\s>]/;
const DOCBOOK_LISTING_OPEN = "<programlisting>";
const DOCBOOK_LISTING_CLOSE = "</programlisting>";
const DOCBOOK_EXAMPLE_PATTERN = /<\/?informalexample>\s*/g;
const DOCBOOK_ITEM_OPEN_PATTERN = /<listitem>\s*(?:<para>\s*)?/g;
const DOCBOOK_ITEM_CLOSE_PATTERN = /(?:<\/para>\s*)?<\/listitem>\s*/g;
const DOCBOOK_LINK_PATTERN = /<link\s+linkend="[^"]*">([\s\S]*?)<\/link>/g;
const DOCBOOK_LITERAL_PATTERN = /<literal>([\s\S]*?)<\/literal>/g;
const DOCBOOK_LIST_PATTERN = /<\/?itemizedlist>\s*/g;
const DOCBOOK_PARA_PATTERN = /<\/?para>\s*/g;
const BLANK_LINE_RUN_PATTERN = /\n{3,}/g;

const renderLink = (kind: string, target: string): string => {
    const segments = target.split(/::|[.:]/);
    const lastIndex = segments.length - 1;

    if (kind === "property" || CALLABLE_LINK_KINDS.has(kind)) {
        segments[lastIndex] = camelCase(segments[lastIndex] ?? "");
    }

    const symbol = segments.join(".");

    return `\`${symbol}${CALLABLE_LINK_KINDS.has(kind) ? "()" : ""}\``;
};

const renderTypeRef = (name: string, member: string | undefined): string => {
    if (member === undefined) {
        return `\`${name}\``;
    }

    return renderLink(member.startsWith("::") ? "signal" : "property", `${name}${member}`);
};

const renderParamRef = (name: string, identifiers: Map<string, string> | undefined): string =>
    `\`${identifiers?.get(name) ?? name}\``;

const trimTrailingNewlines = (value: string): string => {
    let end = value.length;

    while (end > 0 && value[end - 1] === "\n") {
        end -= 1;
    }

    return value.slice(0, end);
};

const renderCodeFence = (body: string): string => {
    const languageMatch = CODE_LANGUAGE_PATTERN.exec(body);
    const fence = (languageMatch?.[1] ?? "").trim().toLowerCase();
    const rest = languageMatch === null ? body : body.slice(languageMatch[0].length);
    const code = trimTrailingNewlines(rest.trimStart());

    return `\`\`\`${fence}\n${code}\n\`\`\``;
};

const renderListing = (code: string): string => `\n\`\`\`\n${code.trim()}\n\`\`\`\n`;

const replaceDocBookTags = (text: string): string =>
    replaceDelimited(text, [DOCBOOK_LISTING_OPEN, DOCBOOK_LISTING_CLOSE], renderListing)
        .replaceAll(DOCBOOK_EXAMPLE_PATTERN, "\n")
        .replaceAll(DOCBOOK_ITEM_OPEN_PATTERN, "\n- ")
        .replaceAll(DOCBOOK_ITEM_CLOSE_PATTERN, "\n")
        .replaceAll(DOCBOOK_LINK_PATTERN, (_match, label: string) => label)
        .replaceAll(DOCBOOK_LITERAL_PATTERN, (_match, literal: string) => `\`${literal}\``)
        .replaceAll(DOCBOOK_LIST_PATTERN, "\n\n")
        .replaceAll(DOCBOOK_PARA_PATTERN, "\n\n");

const docBookToMarkdown = (text: string): string => {
    if (!DOCBOOK_TAG_PATTERN.test(text)) {
        return text;
    }

    return replaceDocBookTags(text).replaceAll(BLANK_LINE_RUN_PATTERN, "\n\n").trim();
};

const replaceDelimited = (raw: string, bounds: [string, string], render: (body: string) => string): string => {
    const [open, close] = bounds;
    let result = "";
    let cursor = 0;

    while (cursor < raw.length) {
        const start = raw.indexOf(open, cursor);

        if (start === -1) {
            break;
        }

        const end = raw.indexOf(close, start + open.length);

        if (end === -1) {
            break;
        }

        result += raw.slice(cursor, start);
        result += render(raw.slice(start + open.length, end));
        cursor = end + close.length;
    }

    return result + raw.slice(cursor);
};

const protectCodeBlocks = (raw: string, protect: (value: string) => string): string =>
    replaceDelimited(raw, [CODE_BLOCK_OPEN, CODE_BLOCK_CLOSE], (body) => protect(renderCodeFence(body)));

const stripHtmlComments = (text: string): string => {
    let current = text;
    let previous = "";

    while (current !== previous) {
        previous = current;
        current = current.replaceAll(HTML_COMMENT_PATTERN, "");
    }

    return current;
};

const gtkDocToMarkdown = (raw: string, identifiers?: Map<string, string>): string => {
    const stash: string[] = [];

    const protect = (value: string): string => {
        const token = `${SENTINEL}${String(stash.length)}${SENTINEL}`;
        stash.push(value);

        return token;
    };

    let text = protectCodeBlocks(docBookToMarkdown(raw), protect);
    text = text.replaceAll(FENCED_BLOCK_PATTERN, (block) => protect(block));
    text = text.replaceAll(INLINE_CODE_PATTERN, (span) => protect(span));
    text = text.replaceAll(LINK_PATTERN, (_match, kind: string, target: string) => protect(renderLink(kind, target)));
    text = text.replaceAll(CONSTANT_PATTERN, (_match, name: string) => protect(`\`${CONSTANT_MAP[name] ?? name}\``));
    text = text.replaceAll(ESCAPED_CONSTANT_PATTERN, "%");

    text = text.replaceAll(TYPE_REF_PATTERN, (_match, name: string, member: string | undefined) =>
        protect(renderTypeRef(name, member)),
    );

    text = text.replaceAll(PARAM_REF_PATTERN, (_match, name: string) => protect(renderParamRef(name, identifiers)));
    text = text.replaceAll(FUNCTION_REF_PATTERN, (_match, name: string) => protect(`\`${name}()\``));
    text = stripHtmlComments(text);

    for (let index = stash.length - 1; index >= 0; index -= 1) {
        const value = stash[index] ?? "";
        text = text.replaceAll(`${SENTINEL}${String(index)}${SENTINEL}`, () => value);
    }

    return text;
};

export { gtkDocToMarkdown };
