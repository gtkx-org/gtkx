import { toCamelCase } from "@gtkx/utils";

const CONSTANT_MAP: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };

const CALLABLE_LINK_KINDS: Set<string> = new Set(["method", "func", "ctor", "vfunc"]);

const SENTINEL = String.fromCharCode(0xe000);

const CODE_BLOCK_PATTERN = /\|\[([\s\S]*?)\]\|/g;
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
    if (CALLABLE_LINK_KINDS.has(kind) || kind === "property") {
        segments[lastIndex] = toCamelCase(segments[lastIndex] ?? "");
    }
    const symbol = segments.join(".");
    return `\`${symbol}${CALLABLE_LINK_KINDS.has(kind) ? "()" : ""}\``;
};

export const gtkDocToMarkdown = (raw: string): string => {
    const stash: string[] = [];
    const protect = (value: string): string => {
        const token = `${SENTINEL}${stash.length}${SENTINEL}`;
        stash.push(value);
        return token;
    };

    let text = raw.replace(CODE_BLOCK_PATTERN, (_match, body: string) => {
        const languageMatch = body.match(CODE_LANGUAGE_PATTERN);
        const fence = (languageMatch?.[1] ?? "").trim().toLowerCase();
        const rest = languageMatch === null ? body : body.slice(languageMatch[0].length);
        const code = rest.replace(/^\s+/, "").replace(/\n+$/, "");
        return protect(`\`\`\`${fence}\n${code}\n\`\`\``);
    });
    text = text.replace(FENCED_BLOCK_PATTERN, (block) => protect(block));
    text = text.replace(INLINE_CODE_PATTERN, (span) => protect(span));
    text = text.replace(LINK_PATTERN, (_match, kind: string, target: string) => protect(renderLink(kind, target)));
    text = text.replace(CONSTANT_PATTERN, (_match, name: string) => protect(`\`${CONSTANT_MAP[name] ?? name}\``));
    text = text.replace(TYPE_REF_PATTERN, (_match, name: string) => protect(`\`${name}\``));
    text = text.replace(PARAM_REF_PATTERN, (_match, name: string) => protect(`\`${name}\``));
    text = text.replace(FUNCTION_REF_PATTERN, (_match, name: string) => protect(`\`${name}()\``));

    for (let index = stash.length - 1; index >= 0; index -= 1) {
        text = text.replaceAll(`${SENTINEL}${index}${SENTINEL}`, stash[index] ?? "");
    }
    return text;
};
