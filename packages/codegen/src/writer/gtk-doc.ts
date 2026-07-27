import { camelCase } from "@gtkx/utils";

const CONSTANT_MAP: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };
const CALLABLE_LINK_KINDS: Set<string> = new Set(["method", "func", "ctor", "vfunc"]);
const SENTINEL = String.fromCodePoint(0xE0_00);
const CODE_BLOCK_OPEN = "|[";
const CODE_BLOCK_CLOSE = "]|";
const CODE_LANGUAGE_PATTERN = /^\s*<!--\s*language="([^"]*)"\s*-->/;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;
const LINK_PATTERN = /\[(\w+)@([\w.:%#-]+)\]/g;
const CONSTANT_PATTERN = /(?<!\w)%(\w+)/g;
const TYPE_REF_PATTERN = /(?<!\w)#(\w+)/g;
const PARAM_REF_PATTERN = /(?<!\w)@(\w+)/g;
const FUNCTION_REF_PATTERN = /\b([a-z_][a-z0-9_]*)\(\)/g;

const renderLink = (kind: string, target: string): string => {
    const segments = target.split(/::|[.:]/);
    const lastIndex = segments.length - 1;

    if (kind === "property" || CALLABLE_LINK_KINDS.has(kind)) {
        segments[lastIndex] = camelCase(segments[lastIndex] ?? "");
    }

    const symbol = segments.join(".");

    return `\`${symbol}${CALLABLE_LINK_KINDS.has(kind) ? "()" : ""}\``;
};

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

const protectCodeBlocks = (raw: string, protect: (value: string) => string): string => {
    let result = "";
    let cursor = 0;

    while (cursor < raw.length) {
        const open = raw.indexOf(CODE_BLOCK_OPEN, cursor);

        if (open === -1) {
            break;
        }

        const close = raw.indexOf(CODE_BLOCK_CLOSE, open + CODE_BLOCK_OPEN.length);

        if (close === -1) {
            break;
        }

        result += raw.slice(cursor, open);
        result += protect(renderCodeFence(raw.slice(open + CODE_BLOCK_OPEN.length, close)));
        cursor = close + CODE_BLOCK_CLOSE.length;
    }

    return result + raw.slice(cursor);
};

const gtkDocToMarkdown = (raw: string): string => {
    const stash: string[] = [];

    const protect = (value: string): string => {
        const token = `${SENTINEL}${String(stash.length)}${SENTINEL}`;
        stash.push(value);

        return token;
    };

    let text = protectCodeBlocks(raw, protect);
    text = text.replaceAll(FENCED_BLOCK_PATTERN, (block) => protect(block));
    text = text.replaceAll(INLINE_CODE_PATTERN, (span) => protect(span));
    text = text.replaceAll(LINK_PATTERN, (_match, kind: string, target: string) => protect(renderLink(kind, target)));
    text = text.replaceAll(CONSTANT_PATTERN, (_match, name: string) => protect(`\`${CONSTANT_MAP[name] ?? name}\``));
    text = text.replaceAll(TYPE_REF_PATTERN, (_match, name: string) => protect(`\`${name}\``));
    text = text.replaceAll(PARAM_REF_PATTERN, (_match, name: string) => protect(`\`${name}\``));
    text = text.replaceAll(FUNCTION_REF_PATTERN, (_match, name: string) => protect(`\`${name}()\``));

    for (let index = stash.length - 1; index >= 0; index -= 1) {
        const value = stash[index] ?? "";
        text = text.replaceAll(`${SENTINEL}${String(index)}${SENTINEL}`, () => value);
    }

    return text;
};

export { gtkDocToMarkdown };
