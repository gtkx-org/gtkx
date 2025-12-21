type GirLinkType =
    | "class"
    | "iface"
    | "struct"
    | "enum"
    | "flags"
    | "error"
    | "callback"
    | "method"
    | "vfunc"
    | "func"
    | "ctor"
    | "property"
    | "signal"
    | "const"
    | "type"
    | "id";

interface GirLink {
    type: GirLinkType;
    namespace: string | undefined;
    target: string;
    member: string | undefined;
}

const GIR_LINK_PATTERN = /\[([a-z]+)@([^\]]+)\]/gi;

function parseGirLink(type: string, reference: string): GirLink | undefined {
    const linkType = type.toLowerCase() as GirLinkType;

    const validTypes: GirLinkType[] = [
        "class",
        "iface",
        "struct",
        "enum",
        "flags",
        "error",
        "callback",
        "method",
        "vfunc",
        "func",
        "ctor",
        "property",
        "signal",
        "const",
        "type",
        "id",
    ];

    if (!validTypes.includes(linkType)) {
    }

    const parts = reference.split(".");
    if (parts.length === 0) {
    }

    if (linkType === "property" || linkType === "signal") {
        const colonIndex = reference.indexOf(":");
        if (colonIndex !== -1) {
            const beforeColon = reference.substring(0, colonIndex);
            const afterColon = reference.substring(colonIndex + 1);
            const beforeParts = beforeColon.split(".");
            if (beforeParts.length >= 2) {
                return {
                    type: linkType,
                    namespace: beforeParts[0],
                    target: beforeParts.slice(1).join("."),
                    member: afterColon.replace("::", ""),
                };
            }
            return {
                type: linkType,
                namespace: undefined,
                target: beforeColon,
                member: afterColon.replace("::", ""),
            };
        }
    }

    if (parts.length === 1) {
        return {
            type: linkType,
            namespace: undefined,
            target: parts[0] ?? "",
            member: undefined,
        };
    }

    if (parts.length === 2) {
        const first = parts[0] ?? "";
        const second = parts[1] ?? "";
        const isNamespace = first.length > 0 && first[0] === first[0]?.toUpperCase();

        if (linkType === "func" || linkType === "const") {
            return {
                type: linkType,
                namespace: first,
                target: second,
                member: undefined,
            };
        }

        if (isNamespace) {
            return {
                type: linkType,
                namespace: first,
                target: second,
                member: undefined,
            };
        }

        return {
            type: linkType,
            namespace: undefined,
            target: first,
            member: second,
        };
    }

    return {
        type: linkType,
        namespace: parts[0],
        target: parts[1] ?? "",
        member: parts.slice(2).join(".") || undefined,
    };
}

interface LinkFormatOptions {
    linkStyle: "namespaced" | "prefixed";
    currentNamespace: string | undefined;
}

function formatGirLinkForTsDoc(link: GirLink, options: LinkFormatOptions): string {
    let displayText: string;
    if (link.member) {
        displayText = `${link.target}.${link.member}`;
    } else {
        displayText = link.target;
    }

    let linkTarget: string;
    if (options.linkStyle === "prefixed") {
        const effectiveNamespace = link.namespace ?? options.currentNamespace;
        if (effectiveNamespace && effectiveNamespace !== "Gtk") {
            linkTarget = `${effectiveNamespace}${displayText}`;
        } else {
            linkTarget = displayText;
        }
    } else {
        linkTarget = link.namespace ? `${link.namespace}.${displayText}` : displayText;
    }

    switch (link.type) {
        case "class":
        case "iface":
        case "struct":
        case "enum":
        case "flags":
        case "error":
        case "callback":
        case "type":
            return `{@link ${linkTarget}}`;

        case "method":
        case "vfunc":
        case "func":
        case "ctor":
            return `{@link ${linkTarget}}`;

        case "property":
            return `{@link ${linkTarget}}`;

        case "signal":
            return `{@link ${linkTarget}}`;

        case "const":
            return `{@link ${linkTarget}}`;

        case "id":
            return `\`${link.target}\``;

        default:
            return `\`${displayText}\``;
    }
}

function convertGirLinks(text: string, options: LinkFormatOptions): string {
    return text.replace(GIR_LINK_PATTERN, (_, type: string, reference: string) => {
        const link = parseGirLink(type, reference);
        if (!link) {
            return `\`${reference}\``;
        }
        return formatGirLinkForTsDoc(link, options);
    });
}

const GTK_DOCS_BASE_URLS: Record<string, string> = {
    Gtk: "https://docs.gtk.org/gtk4",
    Gdk: "https://docs.gtk.org/gdk4",
    Gsk: "https://docs.gtk.org/gsk4",
    GLib: "https://docs.gtk.org/glib",
    GObject: "https://docs.gtk.org/gobject",
    Gio: "https://docs.gtk.org/gio",
    Pango: "https://docs.gtk.org/Pango",
    PangoCairo: "https://docs.gtk.org/PangoCairo",
    GdkPixbuf: "https://docs.gtk.org/gdk-pixbuf",
    Cairo: "https://docs.gtk.org/cairo",
    Adw: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest",
};

function getDocsBaseUrl(namespace: string | undefined): string {
    if (!namespace) {
        return "https://docs.gtk.org/gtk4";
    }
    const baseUrl = GTK_DOCS_BASE_URLS[namespace];
    if (baseUrl) {
        return baseUrl;
    }
    return `https://docs.gtk.org/${namespace.toLowerCase()}`;
}

function convertHtmlImageElements(text: string, baseUrl: string): string {
    let result = text;

    result = result.replace(/<picture[^>]*>([\s\S]*?)<\/picture>/gi, (_, pictureContent: string) => {
        const imgMatch = /<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/i.exec(pictureContent);
        if (!imgMatch) {
            const imgMatch2 = /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/i.exec(pictureContent);
            if (imgMatch2) {
                const src = imgMatch2[1];
                const alt = imgMatch2[2];
                return `![${alt}](${baseUrl}/${src})`;
            }
            return "";
        }
        const alt = imgMatch[1];
        const src = imgMatch[2];
        return `![${alt}](${baseUrl}/${src})`;
    });

    result = result.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, (_, alt: string, src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return `![${alt}](${src})`;
        }
        return `![${alt}](${baseUrl}/${src})`;
    });

    result = result.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (_, src: string, alt: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return `![${alt}](${src})`;
        }
        return `![${alt}](${baseUrl}/${src})`;
    });

    result = result.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, (_, src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return `![](${src})`;
        }
        return `![](${baseUrl}/${src})`;
    });

    result = result.replace(/<source[^>]*\/?>/gi, "");

    return result;
}

function convertMarkdownImageUrls(text: string, baseUrl: string): string {
    return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt: string, src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return match;
        }
        return `![${alt}](${baseUrl}/${src})`;
    });
}

function convertKbdElements(text: string): string {
    return text.replace(/<kbd>([^<]*)<\/kbd>/gi, "`$1`");
}

function stripHtmlLinks(text: string): string {
    return text.replace(/\[([^\]]+)\]\([^)]+\.html[^)]*\)/gi, "$1");
}

function convertAtAnnotations(text: string): string {
    return text.replace(/(?<!\{)@([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\{)/g, "`$1`");
}

function escapeXmlStyleTags(text: string): string {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];

    let processed = text.replace(codeBlockPattern, (match) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    processed = processed.replace(/<(\/?)(child|object|property|signal|template|style|item|attribute)>/gi, "`<$1$2>`");

    for (let i = 0; i < codeBlocks.length; i++) {
        processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i] ?? "");
    }

    return processed;
}

function cleanupWhitespace(text: string): string {
    let result = text.replace(/\n{3,}/g, "\n\n");
    result = result.replace(/[ \t]+$/gm, "");
    return result.trim();
}

interface CodeBlockProtection {
    text: string;
    restore: (formatted: string, linePrefix: string) => string;
}

function protectCodeBlocks(text: string): CodeBlockProtection {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];

    const processed = text.replace(codeBlockPattern, (match) => {
        codeBlocks.push(match);
        return `__PROTECTED_CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    const restore = (formatted: string, linePrefix: string): string => {
        let result = formatted;
        for (let i = 0; i < codeBlocks.length; i++) {
            const placeholder = `__PROTECTED_CODE_BLOCK_${i}__`;
            const codeBlock = codeBlocks[i];
            if (codeBlock === undefined) continue;

            const codeLines = codeBlock.split("\n");
            const prefixedCodeLines = codeLines.map((line, index) => {
                if (index === 0) return line;
                return `${linePrefix}${line}`;
            });
            result = result.replace(placeholder, prefixedCodeLines.join("\n"));
        }
        return result;
    };

    return { text: processed, restore };
}

export interface SanitizeDocOptions {
    escapeXmlTags?: boolean;
    namespace?: string;
    linkStyle?: "namespaced" | "prefixed";
}

export function sanitizeDoc(doc: string, options: SanitizeDocOptions = {}): string {
    let result = doc;

    const baseUrl = getDocsBaseUrl(options.namespace);
    result = convertHtmlImageElements(result, baseUrl);
    result = convertMarkdownImageUrls(result, baseUrl);
    result = convertKbdElements(result);
    result = stripHtmlLinks(result);

    const linkFormatOptions: LinkFormatOptions = {
        linkStyle: options.linkStyle ?? "namespaced",
        currentNamespace: options.namespace,
    };
    result = convertGirLinks(result, linkFormatOptions);
    result = convertAtAnnotations(result);

    if (options.escapeXmlTags) {
        result = escapeXmlStyleTags(result);
    }

    result = cleanupWhitespace(result);

    return result;
}

export function formatDoc(doc: string | undefined, indent: string = "", options: SanitizeDocOptions = {}): string {
    if (!doc) {
        return "";
    }

    const sanitized = sanitizeDoc(doc, options);
    if (!sanitized) {
        return "";
    }

    const { text: protectedText, restore } = protectCodeBlocks(sanitized);

    const lines = protectedText.split("\n").map((line) => line.trim());
    const firstLine = lines[0] ?? "";

    if (lines.length === 1 && firstLine.length < 80) {
        const result = `${indent}/** ${firstLine} */\n`;
        return restore(result, `${indent} * `);
    }

    const formattedLines = lines.map((line) => `${indent} * ${line}`);
    const result = `${indent}/**\n${formattedLines.join("\n")}\n${indent} */\n`;
    return restore(result, `${indent} * `);
}

interface DocParameter {
    name: string;
    doc: string | undefined;
}

export function formatMethodDoc(
    doc: string | undefined,
    params: DocParameter[],
    indent: string = "  ",
    options: SanitizeDocOptions = {},
): string {
    const sanitizedDoc = doc ? sanitizeDoc(doc, options) : undefined;

    const hasDocumentation = sanitizedDoc || params.some((p) => p.doc);
    if (!hasDocumentation) {
        return "";
    }

    const lines: string[] = [];
    let protection: CodeBlockProtection | undefined;

    if (sanitizedDoc) {
        protection = protectCodeBlocks(sanitizedDoc);
        for (const line of protection.text.split("\n")) {
            lines.push(` * ${line.trim()}`);
        }
    }

    for (const param of params) {
        if (param.doc && param.name && param.name !== "..." && param.name !== "") {
            const sanitizedParamDoc = sanitizeDoc(param.doc, options);
            const paramDocFirstLine = sanitizedParamDoc.split("\n")[0]?.trim() ?? "";
            lines.push(` * @param ${param.name} - ${paramDocFirstLine}`);
        }
    }

    if (lines.length === 0) {
        return "";
    }

    const result = `${indent}/**\n${indent}${lines.join(`\n${indent}`)}\n${indent} */\n`;
    return protection ? protection.restore(result, `${indent} * `) : result;
}
